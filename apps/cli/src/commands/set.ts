import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair } from '../crypto';
import { EnvironmentPath } from './utils';
import { environmentCompletions } from '../utils/completions';
import { parseEnv } from 'node:util';

type SetOptions = BaseOptions & {
  instanceUrl?: string;
};

const rootCmd = new RootCommand();
export const setCommand = rootCmd.createCommand<SetOptions>('set')
  .description('Set an environment variable')
  .argumentWithSuggestions('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"', environmentCompletions)
  .argumentWithSuggestions('<key-value>', 'Key-value pair in format "key=value" or as separate arguments', () => Promise.resolve([]))
  .argumentWithSuggestions('[value]', 'Value if provided separately from key OR the path of another environment to copy the key from there', environmentCompletions)
  .action(async function(path: string, keyValue: string, separateValue?: string) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    const userKeyPair = await UserKeyPair.getInstance();
    const client = createTsrClient(instanceUrl);
    
    try {
      // Parse key-value pair
      let key: string, value: string;
      if (separateValue !== undefined) {

        const tryCopyValueFromOtherEnvironment = async () => {
          try {
            const otherValueEnvironment = new EnvironmentPath(separateValue)
            const otherEnvironmentResponse = await client.environments.getEnvironments({
              query: {
                path: otherValueEnvironment.toString(),
                pubkey: userKeyPair.publicKey.toBase64()
              }
            })
            if (otherEnvironmentResponse.status !== 200 || otherEnvironmentResponse.body.length === 0) {
              return null;
            }

            const environment = otherEnvironmentResponse.body[0];
            if (!environment.decryptionData) {
              console.error('Error: No decryption data found for environment');
              process.exit(1);
            }

            // Unwrap the environment's encryption key
            const dek = (await UserKeyPair.getInstance()).unwrapKey({
              wrappedKey: environment.decryptionData.wrappedEncryptionKey,
              ephemeralPublicKey: environment.decryptionData.ephemeralPublicKey
            });
            if(!environment.version) {
              console.error(`Tried to copy value from \`${otherValueEnvironment.toString()}\`, but no version found`);
              process.exit(1);
            }
            const decryptedContent = dek.decryptContent(environment.version.content);
            const parsedEnv = parseEnv(decryptedContent) as Record<string, string | number>;
            if(!parsedEnv[key]) {
              console.error(`Tried to copy value from \`${otherValueEnvironment.toString()}\`, but key \`${key}\` not found`);
              process.exit(1);
            }
            return String(parsedEnv[key]);
          } catch (error) {
            return null;
          }
        }

        key = keyValue;
        value = await tryCopyValueFromOtherEnvironment() ?? separateValue;
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
        query: {
          path: environmentPath.toString(),
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
        // TODO: make this more robust
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
            idOrPath: environmentPath.toString()
          },
          body: {
            content: {
              keys: encryptedContent.keys,
              ciphertext: encryptedContent.ciphertext,
              signature: userKeyPair.sign(encryptedContent.ciphertext)
            }
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to update environment: ${response.status}`, (response.body as { message: string }).message);
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
  .argumentWithSuggestions('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"', environmentCompletions)
  // TODO: completions
  .argument('<key>', 'Key to unset')
  .action(async function(path: string, key: string) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    const client = createTsrClient(instanceUrl);
    
    try {
      if (!key.trim()) {
        console.error('Error: Key cannot be empty');
        process.exit(1);
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

      // Get user's private key for decryption
      const userKeyPair = await UserKeyPair.getInstance();

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
        // TODO: make this more robust
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
            idOrPath: environmentPath.toString()
          },
          body: {
            content: {
              keys: encryptedContent.keys,
              ciphertext: encryptedContent.ciphertext,
              signature: userKeyPair.sign(encryptedContent.ciphertext)
            }
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to update environment: ${response.status}`, (response.body as { message: string }).message);
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
