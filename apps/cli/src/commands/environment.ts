import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair } from '../crypto';

type EnvironmentOptions = BaseOptions & {
  instanceUrl?: string;
};

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
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(filterPath?: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

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
        console.error(`Failed to fetch environments: ${response.status}`);
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
  .option('--instance-url <url>', 'URL of the server to connect to')
  .option('--secret-key-file <path>', 'File to store the generated secret key in')
  .action(async function(environmentPath: string, filePath?: string) {
    const opts = this.opts<CreateEnvironmentOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Creating environment: ${environmentPath}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // Validate environment path format
      const parts = environmentPath.split(':');
      if (parts.length !== 3) {
        console.error('Error: Environment path must be in format "organization-name:project-name:env-name"');
        process.exit(1);
      }

      const [organizationName, projectName, environmentName] = parts;
      if (!organizationName.trim() || !projectName.trim() || !environmentName.trim()) {
        console.error('Error: All parts (organization, project, environment) must be non-empty');
        process.exit(1);
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
        console.log(`\nEnvironment path: ${organizationName.trim()}:${projectName.trim()}:${environmentName.trim()}`);
      }
      
      if(opts.verbose) {
        console.log(`Found ${Object.keys(envVars).length} environment variables`);
      }
      
      try {
        const { encryptedEnvironment, wrappedKeys, dekBase64 } = userKeyPair.newEncryptionWithKeyExchange(
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
            name: environmentName,
            project: `${organizationName}:${projectName}`,
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
  .argument('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"')
  .argument('<file>', 'Path to .env file')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(environmentPath: string, filePath: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Updating environment: ${environmentPath}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // First get the environment to get the decryption data
      const envResponse = await client.environments.getEnvironments({
        query: { path: environmentPath }
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
            idOrPath: environmentPath
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