import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { getUserPrivateKey } from '../utils/keypair';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair } from '../crypto';

type SetOptions = BaseOptions & {
  instanceUrl?: string;
};

const rootCmd = new RootCommand();
export const setCommand = rootCmd.createCommand<SetOptions>('set')
  .description('Set an environment variable')
  .argument('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"')
  .argument('<key-value>', 'Key-value pair in format "key=value" or as separate arguments')
  .argument('[value]', 'Value if provided separately from key')
  .action(async function(environmentPath: string, keyValue: string, separateValue?: string) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    
    try {
      // Parse key-value pair
      let key: string, value: string;
      if (separateValue !== undefined) {
        key = keyValue;
        value = separateValue;
      } else {
        const parts = keyValue.split('=');
        if (parts.length !== 2) {
          console.error('Error: Key-value pair must be in format "key=value" or provided as separate arguments');
          process.exit(1);
        }
        [key, value] = parts;
      }

      if (!key.trim()) {
        console.error('Error: Key cannot be empty');
        process.exit(1);
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

      // Get user's private key for decryption
      const userKeyPair = await getUserPrivateKey();
      if (!userKeyPair) {
        console.error('Error: No keypair found. Please run "envie config keypair <path>" first.');
        process.exit(1);
      }
      const userPrivateKey = userKeyPair.privateKey;

      try {
        // Unwrap the environment's encryption key
        const dek = (await UserKeyPair.getInstance()).unwrapKey({
          wrappedKey: environment.decryptionData.wrappedEncryptionKey,
          ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey
        });

        // Get current content and update/add the new key-value pair
        let currentContent = "";
        if (environment.version) {
          // Decrypt the content
          currentContent = dek.decryptContent(environment.version.content);
        }

        // Parse current content into lines
        const lines = currentContent.split('\n').filter(line => line.trim());
        const existingKeyIndex = lines.findIndex(line => line.startsWith(`${key}=`));

        if (existingKeyIndex !== -1) {
          lines[existingKeyIndex] = `${key}=${value}`;
        } else {
          lines.push(`${key}=${value}`);
        }

        // Encrypt the updated content
        const encryptedContent = dek.encryptContent(lines.join('\n'));

        if (opts.verbose) {
          console.log('\nEncryption successful!');
        }
        
        // Update environment content
        const response = await client.environments.updateEnvironmentContent({
          params: {
            idOrPath: environmentPath
          },
          body: {
            encryptedContent: {
              keys: encryptedContent.keys,
              ciphertext: encryptedContent.ciphertext
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

export const unsetCommand = rootCmd.createCommand<SetOptions>('unset')
  .description('Unset an environment variable')
  .argument('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"')
  .argument('<key>', 'Key to unset')
  .action(async function(environmentPath: string, key: string) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    
    try {
      if (!key.trim()) {
        console.error('Error: Key cannot be empty');
        process.exit(1);
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

      // Get user's private key for decryption
      const userKeyPair = await getUserPrivateKey();
      if (!userKeyPair) {
        console.error('Error: No keypair found. Please run "envie config keypair <path>" first.');
        process.exit(1);
      }
      const userPrivateKey = userKeyPair.privateKey;

      try {
        // Unwrap the environment's encryption key
        const dek = (await UserKeyPair.getInstance()).unwrapKey({
          wrappedKey: environment.decryptionData.wrappedEncryptionKey,
          ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey
        });

        // Get current content and remove the key
        let currentContent = "";
        if (environment.version) {
          // Decrypt the content
          currentContent = dek.decryptContent(environment.version.content);
        }

        // Parse current content into lines and remove the key
        const lines = currentContent.split('\n')
          .filter(line => line.trim() && !line.startsWith(`${key}=`));

        // Encrypt the updated content
        const encryptedContent = dek.encryptContent(lines.join('\n'));

        if (opts.verbose) {
          console.log('\nEncryption successful!');
        }
        
        // Update environment content
        const response = await client.environments.updateEnvironmentContent({
          params: {
            idOrPath: environmentPath
          },
          body: {
            encryptedContent: {
              keys: encryptedContent.keys,
              ciphertext: encryptedContent.ciphertext
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
