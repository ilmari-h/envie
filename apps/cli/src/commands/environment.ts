import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair, X25519PublicKey } from '../crypto';
import { parseExpiryDate } from '../utils/time';
import { EnvironmentPath } from './utils';

type EnvironmentOptions = BaseOptions;

type CreateEnvironmentOptions = EnvironmentOptions & {
  secretKeyFile?: string;
};

const rootCmd = new RootCommand();
export const environmentCommand = rootCmd.createCommand<EnvironmentOptions>('environment')
  .alias('e')
  .description('Manage environments');

environmentCommand
  .command('list')
  .description('List environments, optionally filtering by path')
  .argument('[path]', 'Path to filter by (organization name or organization:project)')
  .action(async function(filterPath?: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {

      if (opts.verbose) {
        console.log(`Connecting to instance: ${instanceUrl}`);
        console.log(`Filter path: ${filterPath || 'none'}`);
      }

      const client = createTsrClient(instanceUrl);
      
      // Determine if path is organization or project path
      const pathParts = filterPath?.split(':') ?? [];
      let queryParams = pathParts.length > 0 ? {path: filterPath} : {};
      
      if (opts.verbose) {
        console.log(`Query parameters:`, queryParams);
      }
      
      const response = await client.environments.getEnvironments({
        query: queryParams
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environments: ${response.status} ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Found ${response.body.length} environments`);
      }

      printTable(
        [
          { header: 'Path', key: 'path' },
          // { header: 'Variables', key: 'variables' },
          { header: 'ID', key: 'id' },
          { header: 'Versions', key: 'versions' },
        ],
        response.body.map(env => ({
          path: `${env.project.organization.name}:${env.project.name}:${env.name}`,
          versions: env.version?.versionNumber || '0',
          id: env.id
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('create')
  .description('Create a new environment')
  .argument('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"')
  .argument('[file]', 'A file containing the initial content')
  .option('--secret-key-file <path>', 'File to store the generated secret key in')
  .action(async function(pathParam: string, filePath?: string) {
    const opts = this.opts<CreateEnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    const environmentPath = new EnvironmentPath(pathParam);
    
    try {
      if (opts.verbose) {
        console.log(`Creating environment: ${environmentPath.toString()}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // Validate and read the .env file
      if (filePath && !fs.existsSync(filePath)) {
        console.error(`Error: File "${filePath}" does not exist`);
        process.exit(1);
      }

      let fileContent: string = "";
      if (filePath) {
        try {
          const absoluteFilePath = path.resolve(filePath);
          fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
        } catch (error) {
          console.error(`Error: Unable to read file "${filePath}": ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      }

      // Parse .env file content
      const envVars = parseEnv(fileContent);
      const parsedEnvFileContent = Object.entries(envVars).map(([key, value]) => `${key}=${value}`).join('\n');

      // Get user's keypair for encryption
      const userKeyPair = await UserKeyPair.getInstance();

      if (opts.verbose) {
        console.log('Parsed .env file content:');
        console.log(JSON.stringify(envVars, null, 2));
        console.log(`\nEnvironment path: ${environmentPath.toString()}`);
      }
      
      if(opts.verbose) {
        console.log(`Found ${Object.keys(envVars).length} environment variables`);
      }
      
      try {
        const { encryptedEnvironment, wrappedKeys, dekBase64 } = userKeyPair.encryptWithKeyExchange(
          [userKeyPair.publicKey], // TODO: add recipients
          parsedEnvFileContent
        );

        if (opts.verbose) {
          console.log('\nEncryption successful!');
          console.log('Encrypted content keys:', encryptedEnvironment.keys);
          console.log('User wrapped key:', {
            wrappedKey: wrappedKeys[0].wrappedKey,
            ephemeralPublicKey: wrappedKeys[0].ephemeralPublicKey
          });
        }
        
        // Create environment
        const response = await client.environments.createEnvironment({
          body: {
            name: environmentPath.environmentName,
            project: environmentPath.projectPath.toString(),
            encryptedContent: {
              keys: encryptedEnvironment.keys,
              ciphertext: encryptedEnvironment.ciphertext
            },
            userWrappedAesKey: wrappedKeys[0].wrappedKey,
            userEphemeralPublicKey: wrappedKeys[0].ephemeralPublicKey,
          }
        });

        if (response.status !== 201) {
          console.error(`Failed to create environment: ${(response.body as { message: string }).message}`);
          process.exit(1);
        }

        console.log(chalk.green(`Environment created!`));

        // Write the secret key to a file or display it
        if (opts.secretKeyFile) {
          fs.writeFileSync(opts.secretKeyFile, `${dekBase64}\n`, 'utf-8');
          console.log(
            `Backup secret key written to ${opts.secretKeyFile}.\n`
            + chalk.red("STORE IT SOMEWHERE SAFE!\n")
            + `It can be used to decrypt this environment's content without your keypair.`);
        } else {
          console.log(
            `Backup secret key: ${dekBase64}\n`
            + chalk.red("STORE IT SOMEWHERE SAFE!\n")
            + `It can be used to decrypt this environment's content without your keypair.`);
        }

      } catch (error) {
        console.error('Error during encryption:', error instanceof Error ? error.message : error);
        process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('update')
  .description('Update an environment\'s content from a file')
  .argument('<path>', 'Environment path')
  .argument('<file>', 'Path to .env file')
  .action(async function(pathParam: string, filePath: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    const environmentPath = new EnvironmentPath(pathParam);

    try {
      if (opts.verbose) {
        console.log(`Updating environment: ${environmentPath.toString()}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // First get the environment to get the decryption data
      const envResponse = await client.environments.getEnvironments({
        query: { path: environmentPath.toString() }
      });

      if (envResponse.status !== 200 || envResponse.body.length === 0) {
        console.error('Error: Environment not found');
        process.exit(1);
      }

      const environment = envResponse.body[0];
      if (!environment.decryptionData) {
        console.error('Error: No decryption data found for environment');
        process.exit(1);
      }

      // Validate and read the .env file
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File "${filePath}" does not exist`);
        process.exit(1);
      }

      const absoluteFilePath = path.resolve(filePath);
      let fileContent: string;
      
      try {
        fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
      } catch (error) {
        console.error(`Error: Unable to read file "${filePath}": ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }

      // Parse .env file content
      const envVars = parseEnv(fileContent);
      const parsedEnvFileContent = Object.entries(envVars).map(([key, value]) => `${key}=${value}`).join('\n');

      if (Object.keys(envVars).length === 0) {
        console.error('Error: No valid environment variables found in the file');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log('Parsed .env file content:');
        console.log(JSON.stringify(envVars, null, 2));
        console.log(`\nEnvironment path: ${environmentPath}`);
        console.log(`Found ${Object.keys(envVars).length} environment variables`);
      }
      
      try {
        const userKeyPair = await UserKeyPair.getInstance();
        const dek = userKeyPair.unwrapKey({
          wrappedKey: environment.decryptionData.wrappedEncryptionKey,
          ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey
        });
        const encryptedEnvironment = dek.encryptContent(parsedEnvFileContent);

        // Update environment content
        const response = await client.environments.updateEnvironmentContent({
          params: {
            idOrPath: environmentPath.toString()
          },
          body: {
            encryptedContent: {
              keys: encryptedEnvironment.keys,
              ciphertext: encryptedEnvironment.ciphertext
            }
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to update environment: ${response.status}`);
          process.exit(1);
        }
      } catch (error) {
        console.error('Error during encryption:', error instanceof Error ? error.message : error);
        process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('set-access')
  .description('Grant or update access to an environment for a user')
  .argument('<path>', 'Environment path')
  .argument('<user-or-token>', 'User name, token name, or ID to grant access to')
  .option('--write [true|false]', 'Grant write access (default: false)', (value) => {
    if (value && value === 'false') {
      return false;
    } else {
      return true;
    }
  })
  .option('--expiry <date>', 'Access expiry date in YYYY-MM-DD format (e.g., "2024-12-31")')
  .action(async function(path: string, userIdOrName: string) {
    const opts = this.opts<EnvironmentOptions & { write?: boolean, expiry?: string }>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Parse expiry date if provided
      if (opts.expiry) {
        try {
          parseExpiryDate(opts.expiry);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      }

      const client = createTsrClient(instanceUrl);
      
      // Get environment access key and wrap it with the user's public key
      const userKeyPair = await UserKeyPair.getInstance();
      const [accessKeys, userPublicKey] = await Promise.all([
        client.environments.getDecryptionKeys({
          params: { idOrPath: environmentPath.toString() }
        }),
        client.publicKeys.getPublicKey({
          params: { userOrTokenNameOrId: userIdOrName }
        })
      ]);
      if (accessKeys.status !== 200 ) {
        console.error(`Failed to get environment access keys: ${(accessKeys.body as { message: string }).message}`);
        process.exit(1);
      }
      if (userPublicKey.status !== 200) {
        console.error(`Failed to get user public key: ${(userPublicKey.body as { message: string }).message}`);
        process.exit(1);
      }

      const dek = userKeyPair.unwrapKey({
        wrappedKey: accessKeys.body.x25519DecryptionData.wrappedDek,
        ephemeralPublicKey: accessKeys.body.x25519DecryptionData.ephemeralPublicKey
      });
      const wrappedDek = dek.wrap(new X25519PublicKey(userPublicKey.body.x25519PublicKey));

      const response = await client.environments.setEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() },
        body: {
          userIdOrName,
          write: opts.write,
          expiresAt: opts.expiry,
          ephemeralPublicKey: wrappedDek.ephemeralPublicKey,
          encryptedSymmetricKey: wrappedDek.wrappedKey
        }
      });

      if (response.status !== 200) {
        console.error(`Failed to set environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('remove-access')
  .description('Remove a user\'s access to an environment')
  .argument('<path>', 'Environment path')
  .argument('<user>', 'User to remove access from')
  .action(async function(path: string, userIdOrName: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.environments.deleteEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() },
        body: { userIdOrName }
      });

      if (response.status !== 200) {
        console.error(`Failed to remove environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('list-access')
  .description('List users and tokens with access to an environment')
  .argument('<path>', 'Environment path')
  .action(async function(path: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.environments.listEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() }
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Name', key: 'name' },
          { header: 'Type', key: 'type' },
          { header: 'ID', key: 'id' },
          { header: 'Write Access', key: 'write' },
        ],
        response.body.users.map(user => ({
          name: user.name,
          type: user.type,
          id: user.id,
          write: user.write ? '✓' : '✗'
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .command('delete')
  .description('Delete an environment and all its data')
  .argument('<path>', 'Environment path')
  .action(async function(path: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Ask for confirmation
      process.stdout.write(chalk.red(`Are you sure you want to delete environment "${environmentPath.toString()}"? This action cannot be undone. [y/N] `));
      
      const response = await new Promise<string>(resolve => {
        process.stdin.once('data', data => {
          resolve(data.toString().trim().toLowerCase());
        });
      });

      if (response !== 'y') {
        console.log('Operation cancelled.');
        process.exit(0);
      }

      const client = createTsrClient(instanceUrl);
      const deleteResponse = await client.environments.deleteEnvironment({
        params: { idOrPath: environmentPath.toString() }
      });

      if (deleteResponse.status !== 200) {
        console.error(`Failed to delete environment: ${(deleteResponse.body as { message: string }).message}`);
        process.exit(1);
      }

      console.log(chalk.green('Environment deleted successfully.'));
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });