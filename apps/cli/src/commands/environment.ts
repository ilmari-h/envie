import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import { encryptForRecipients } from '../utils/crypto';
import { getUserPrivateKey, getUserPublicKey, ed25519PublicKeyToX25519 } from '../utils/keypair';
import { RootCommand, BaseOptions } from './root';

type EnvironmentOptions = BaseOptions & {
  instanceUrl?: string;
};

type CreateEnvironmentOptions = EnvironmentOptions;

const rootCmd = new RootCommand();
export const environmentCommand = rootCmd.createCommand<EnvironmentOptions>('environment')
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
          { header: 'Name', key: 'name' },
          // { header: 'Project', key: 'project' },
          //{ header: 'Organization', key: 'organization' },
          //{ header: 'Variables', key: 'variables' },
          { header: 'Version', key: 'version' },
          { header: 'ID', key: 'id' },
        ],
        response.body.map(env => ({
          name: env.name,
          //project: env.project.name,
          //organization: env.project.organization.name,
          // variables: env.latestVersion.
          version: env.latestVersion?.versionNumber || 'N/A',
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
  .description('Create a new environment from a file')
  .argument('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"')
  .argument('<file>', 'Path to .env file')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(environmentPath: string, filePath: string) {
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

      // Get user's keypair for encryption
      const userKeyPair = await getUserPrivateKey();
      if (!userKeyPair) {
        console.error('Error: No keypair found. Please run "envie config keypair <path>" first.');
        process.exit(1);
      }

      const userPublicKey = await getUserPublicKey();
      if (!userPublicKey) {
        console.error('Error: Unable to get user public key.');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log('Parsed .env file content:');
        console.log(JSON.stringify(envVars, null, 2));
        console.log(`\nEnvironment path: ${organizationName.trim()}:${projectName.trim()}:${environmentName.trim()}`);
      }
      
      console.log(`Found ${Object.keys(envVars).length} environment variables`);
      
      try {
        const { encryptedContent, wrappedKeys } = encryptForRecipients(
          parsedEnvFileContent,
          [userPublicKey] // User's own public key as the only recipient
        );

        if (opts.verbose) {
          console.log('\nEncryption successful!');
          console.log('Encrypted content keys:', encryptedContent.keys);
          console.log('Ciphertext length:', encryptedContent.ciphertext.length);
          console.log('User wrapped key:', {
            wrappedKey: wrappedKeys[0].wrappedKey,
            ephemeralPublicKey: wrappedKeys[0].ephemeralPublicKey
          });
        }
        
        // TODO: Make API call to create environment
        const response = await client.environments.createEnvironment({
          body: {
            name: environmentName,
            project: `${organizationName}:${projectName}`,
            encryptedContent: {
              keys: encryptedContent.keys,
              ciphertext: encryptedContent.ciphertext
            },
            userWrappedAesKey: wrappedKeys[0].wrappedKey,
            userEphemeralPublicKey: wrappedKeys[0].ephemeralPublicKey,
          }
        });

        if (response.status !== 201) {
          console.error(`Failed to create environment: ${response.status}`);
          process.exit(1);
        }

        console.log(`Environment created successfully: ${response.body.id}`);
      } catch (error) {
        console.error('Error during encryption:', error instanceof Error ? error.message : error);
        process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });