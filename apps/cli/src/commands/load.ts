import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { getUserPrivateKey } from '../utils/keypair';
import { RootCommand, BaseOptions } from './root';
import { DataEncryptionKey, UserKeyPair } from '../crypto';

type LoadOptions = BaseOptions & {
  instanceUrl?: string;
  ver?: string;
  decrypt?: boolean;
  backupKey?: string;
};

const rootCmd = new RootCommand();
export const loadCommand = rootCmd.createCommand<LoadOptions>('load')
  .description('Load an environment')
  .argument('<path>', 'Environment path in format "organization-name:project-name:env-name"')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .option('-V, --version <version>', 'Version of the environment to load')
  .option('-d, --decrypt', 'Decrypt and show the environment variables')
  .option('-b, --backup-key <key-file>', 'Restore the environment from a backup key')
  .action(async function(environmentPath: string) {
    const opts = this.opts<LoadOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      // Validate environment path format (must have exactly 3 parts)
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

      const client = createTsrClient(instanceUrl);
      
      // Get the specific environment using the path
      const response = await client.environments.getEnvironments({
        query: { path: environmentPath, version: opts.ver }
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

      // Check if decryption is requested
      if (opts.decrypt) {
        // Get user's private key for decryption
        const userKeyPair = await getUserPrivateKey();
        if (!userKeyPair) {
          console.error('Error: No keypair found. Please run "envie config keypair <path>" first.');
          process.exit(1);
        }

        try {
          const dek = opts.backupKey
          ? await DataEncryptionKey.readFromFile(opts.backupKey)
          : (await UserKeyPair.getInstance()).unwrapKey({
              wrappedKey: environment.decryptionData.wrappedEncryptionKey,
              ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey
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