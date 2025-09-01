import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair, Ed25519PublicKey, DataEncryptionKey } from '../crypto';
import { EnvironmentPath, ExpiryFromNow } from './utils';
import { filepathCompletions, projectCompletions, userCompletions, environmentCompletions, projectCompletionsWithTrailingColon, userAndTokenCompletions } from '../utils/completions';
import { confirm } from '../ui/confirm';

type EnvironmentOptions = BaseOptions;

type CreateEnvironmentOptions = EnvironmentOptions & {
  secretKeyFile?: string;
};
type ShowOptions = BaseOptions & {
  ver?: string;
  backupKey?: string;
  unsafeDecrypt?: boolean;
};

const rootCmd = new RootCommand();
export const environmentCommand = rootCmd.createCommand<EnvironmentOptions>('environment')
  .alias('e')
  .description('Manage environments');

environmentCommand
  .commandWithSuggestions('list')
  .description('List environments, optionally filtering by path')
  .argumentWithSuggestions('[path]', 'Path to filter by (organization name or organization:project)', projectCompletions)
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
  .commandWithSuggestions('create')
  .description('Create a new environment')
  .argumentWithSuggestions('<path>', 'Environment path', projectCompletionsWithTrailingColon)
  .argumentWithSuggestions('[file]', 'A file containing the initial content', filepathCompletions)
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
      const [userKeyPair, userData] = await Promise.all([
        UserKeyPair.getInstance(),
        client.user.getUser()
      ]);

      if (userData.status !== 200 ) {
        console.error(`Failed to get user data: ${(userData.body as { message: string }).message}`);
        process.exit(1);
      }

      if (opts.verbose) {
        console.log('Parsed .env file content:');
        console.log(JSON.stringify(envVars, null, 2));
        console.log(`\nEnvironment path: ${environmentPath.toString()}`);
      }
      
      if(opts.verbose) {
        console.log(`Found ${Object.keys(envVars).length} environment variables`);
      }
      
      try {

        // Create DEK wrapped with just the user's own public key
        const { encryptedEnvironment, wrappedKeys, dekBase64 } = DataEncryptionKey.newWithPKE(
          userData.body.publicKeys.map(pk => new Ed25519PublicKey(pk.valueBase64)),
          parsedEnvFileContent
        );

        console.log(userKeyPair.sign(encryptedEnvironment.ciphertext));

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
            content: {
              keys: encryptedEnvironment.keys,
              ciphertext: encryptedEnvironment.ciphertext,
              signature: userKeyPair.sign(encryptedEnvironment.ciphertext)
            },
            decryptionData: wrappedKeys.map(key => ({
              publicKeyBase64: key.publicKeyBase64,
              wrappedEncryptionKey: key.wrappedKey,
              ephemeralPublicKey: key.ephemeralPublicKey
            }))
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
  .commandWithSuggestions('show')
  .description('Show an environment')
  .argumentWithSuggestions('<path>', 'Environment path (or name if rest of the path is specified in envierc.json)', environmentCompletions)
  .option('-V, --version <version>', 'Version of the environment to load')
  .option('-b, --backup-key <key-file>', 'Restore the environment from a backup key')
  .option('--unsafe-decrypt', 'Decrypt and print the environment variables to stdout')
  .action(async function(path: string) {
    const opts = this.opts<ShowOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      // Validate environment path format (must have exactly 3 parts)
      const environmentPath = new EnvironmentPath(path);

      const client = createTsrClient(instanceUrl);
      const userKeyPair = await UserKeyPair.getInstance();
      
      // Get the specific environment using the path
      const response = await client.environments.getEnvironments({
        query: {
          path: environmentPath.toString(),
          version: opts.ver,
          pubkey: userKeyPair.publicKey.toBase64()
        }
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environment: ${response.status}`);
        process.exit(1);
      }

      if (response.body.length === 0) {
        console.error('Environment not found');
        process.exit(1);
      }

      const environment = response.body[0];
      
      if (!environment.version) {
        console.error('Version not found');
        process.exit(1);
      }

      const decryptionData = environment.decryptionData
      if(!decryptionData) {
        console.error('Decryption data not found');
        process.exit(1);
      }

      // Check if decryption is requested
      if (opts.unsafeDecrypt) {
        try {
          const dek = opts.backupKey
          ? await DataEncryptionKey.readFromFile(opts.backupKey)
          : (await UserKeyPair.getInstance()).unwrapKey({
              wrappedKey: decryptionData.wrappedEncryptionKey,
              ephemeralPublicKey: decryptionData.ephemeralPublicKey
            });

          const decryptedContent = dek.decryptContent(environment.version.content);
          
          // Print decrypted content to stdout (no other output)
          console.log(decryptedContent);
          
        } catch (error) {
          console.error('Error during decryption:', error instanceof Error ? error.message : error);
          process.exit(1);
        }
      } else {
        // Print keys with "<encrypted>" as values
        const keys = environment.version.keys;
        for (const key of keys) {
          console.log(`${key}=<encrypted>`);
        }
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });


environmentCommand
  .commandWithSuggestions('update')
  .description('Update an environment\'s content from a file')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<file>', 'Path to .env file', filepathCompletions)
  .action(async function(pathParam: string, filePath: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    const environmentPath = new EnvironmentPath(pathParam);
    const userKeyPair = await UserKeyPair.getInstance();

    try {
      if (opts.verbose) {
        console.log(`Updating environment: ${environmentPath.toString()}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // First get the environment to get the decryption data
      const envResponse = await client.environments.getEnvironments({
        query: {
          path: environmentPath.toString(),

          // Request decryption data for the user's public key
          pubkey: userKeyPair.publicKey.toBase64()
        }
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
        const dek = userKeyPair.unwrapKey({
          wrappedKey: environment.decryptionData.wrappedEncryptionKey,
          ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey,
        });

        // Decrypt current environment to compare
        const currentEnvVars: Record<string, string | number> = environment.version
          ? parseEnv(dek.decryptContent(environment.version.content)) as Record<string, string | number>
          : {};

        // Compare old and new environment variables
        const currentKeys = new Set(Object.keys(currentEnvVars));
        const newKeys = new Set(Object.keys(envVars));
        
        const addedKeys = [...newKeys].filter(key => !currentKeys.has(key));
        const deletedKeys = [...currentKeys].filter(key => !newKeys.has(key));
        const modifiedKeys = [...newKeys].filter(key => 
          currentKeys.has(key) && currentEnvVars[key] !== envVars[key as keyof typeof envVars]
        );

        // Show diff
        console.log('\nChanges to be made:');
        
        if (addedKeys.length === 0 && deletedKeys.length === 0 && modifiedKeys.length === 0) {
          console.log(chalk.gray('No changes detected.'));
          process.exit(0);
        }

        // Show added keys (green with +)
        addedKeys.forEach(key => {
          console.log(chalk.green(`+ ${key}`));
        });

        // Show modified keys (yellow with M)
        modifiedKeys.forEach(key => {
          console.log(chalk.yellow(`M ${key}`));
        });

        // Show deleted keys (red with -)
        deletedKeys.forEach(key => {
          console.log(chalk.red(`- ${key}`));
        });

        // Show summary and confirm
        const summary = [];
        if (addedKeys.length > 0) summary.push(`${addedKeys.length} new`);
        if (modifiedKeys.length > 0) summary.push(`${modifiedKeys.length} modified`);
        if (deletedKeys.length > 0) summary.push(`${deletedKeys.length} deleted`);

        console.log(`\Summary: ${summary.join(', ')}. Update environment with these changes? (y/N)`);
        
        const confirmed = await confirm({
          prompt: '',
          defaultNo: true
        });

        if (!confirmed) {
          process.exit(0);
        }

        const encryptedEnvironment = dek.encryptContent(parsedEnvFileContent);

        // Update environment content
        const response = await client.environments.updateEnvironmentContent({
          params: {
            idOrPath: environmentPath.toString()
          },
          body: {
            content: {
              keys: encryptedEnvironment.keys,
              ciphertext: encryptedEnvironment.ciphertext,
              signature: userKeyPair.sign(encryptedEnvironment.ciphertext)
            }
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to update environment: ${response.status}`);
          process.exit(1);
        }

        console.log(chalk.green('Environment updated successfully!'));
        process.exit(0);
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
  .commandWithSuggestions('set-access')
  .description('Grant or update access to an environment for a user')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<user-or-token>', 'User name, token name, or ID to grant access to', userAndTokenCompletions)
  .option('--write [true|false]', 'Grant write access (default: false)', (value) => {
    if (value && value === 'false') {
      return false;
    } else {
      return true;
    }
  })
  .option('--expiry <date>', 'Access expiry date in duration format (e.g., "1h", "1h30m", "1d", "1w", "1m", "1y")')
  .action(async function(path: string, userIdOrName: string) {
    const opts = this.opts<EnvironmentOptions & { write?: boolean, expiry?: string }>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Parse expiry date if provided
      const expiryDate = opts.expiry ? new ExpiryFromNow(opts.expiry) : undefined;

      const client = createTsrClient(instanceUrl);
      
      // Get environment access key and wrap it with the user's public keys
      const userKeyPair = await UserKeyPair.getInstance();
      const [myAccess, targetPublicKeys] = await Promise.all([
        client.publicKeys.getDecryptionKeys({
          params: {
            // Request decryption data for the user's public key
            pubkeyBase64Url: userKeyPair.publicKey.toBase64Url()
          },
          query: {
            environment: environmentPath.toString()
          }
        }),
        client.publicKeys.getPublicKeys({
          params: { userOrTokenNameOrId: userIdOrName }
        })
      ]);
      if (myAccess.status !== 200 ) {
        console.error(`Failed to get environment access keys: ${(myAccess.body as { message: string }).message}`);
        process.exit(1);
      }
      if (targetPublicKeys.status !== 200) {
        console.error(`Failed to get user public keys: ${(targetPublicKeys.body as { message: string }).message}`);
        process.exit(1);
      }

      if(myAccess.body.deks.length === 0) {
        console.error('No decryption data found for environment');
        process.exit(1);
      }
      const [decryptionData] = myAccess.body.deks;

      const dek = userKeyPair.unwrapKey({
        wrappedKey: decryptionData.wrappedDek,
        ephemeralPublicKey: decryptionData.ephemeralPublicKey,
      });
      const wrappedDeks = targetPublicKeys.body.publicKeys.map(pk => dek.wrap(new Ed25519PublicKey(pk.valueBase64)));
      const response = await client.environments.setEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() },
        body: {
          userOrAccessToken: userIdOrName,
          write: opts.write,
          expiresAt: expiryDate?.toDate().toISOString(),
          decryptionData: wrappedDeks.map(key => ({
            publicKeyBase64: key.publicKeyBase64,
            wrappedEncryptionKey: key.wrappedKey,
            ephemeralPublicKey: key.ephemeralPublicKey
          })),
          signature: userKeyPair.sign(wrappedDeks.map(key => key.publicKeyBase64).join(''))
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
  .commandWithSuggestions('remove-access')
  .description('Remove a user\'s access to an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<user-or-token>', 'User or token to remove access from', userAndTokenCompletions)
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
  .commandWithSuggestions('list-access')
  .description('List users and tokens with access to an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
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
  .commandWithSuggestions('delete')
  .description('Delete an environment and all its data')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .action(async function(path: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Ask for confirmation
      const confirmed = await confirm({
        prompt: `Are you sure you want to delete environment "${environmentPath.toString()}"? This action cannot be undone.`,
        dangerColor: true
      });

      if (!confirmed) {
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