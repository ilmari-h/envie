import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair } from '../crypto';
import { EnvironmentPath } from './utils/environment-path';
import { variableGroupAndEnvironmentCompletions } from '../utils/completions';
import { parseEnv } from 'node:util';

type SetOptions = BaseOptions & {
  instanceUrl?: string;
};

const rootCmd = new RootCommand();
export const setCommand = rootCmd.createCommand<SetOptions>('set')
  .description('Set environment variables')
  .argumentWithSuggestions('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"', variableGroupAndEnvironmentCompletions)
  .argument('[KEY=VALUE...]', 'Space-separated key=value pairs')
  .action(async function(path: string, keyValuePairs: string[]) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    const userKeyPair = await UserKeyPair.getInstance();
    const client = createTsrClient(instanceUrl);
    
    try {
      // Parse key-value pairs
      if (keyValuePairs.length === 0) {
        console.error('Error: At least one key=value pair must be provided');
        process.exit(1);
      }

      const parsedPairs: Array<{ key: string; value: string }> = [];
      
      for (const keyValue of keyValuePairs) {
        const parts = keyValue.split('=');
        if (parts.length !== 2) {
          console.error(`Error: Key-value pair must be in format "key=value", got: "${keyValue}"`);
          process.exit(1);
        }
        
        const [key, value] = parts;
        if (!key.trim()) {
          console.error('Error: Key cannot be empty');
          process.exit(1);
        }
        
        parsedPairs.push({ key: key.trim(), value });
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
        const lines = Object.entries(parseEnv(currentContent) as Record<string, string>)
          .map(([key, value]) => `${key}=${value}`);

        // Update/add each key-value pair
        for (const { key, value } of parsedPairs) {
          const existingKeyIndex = lines.findIndex(line => line.startsWith(`${key}=`));
          
          if (existingKeyIndex !== -1) {
            lines[existingKeyIndex] = `${key}=${value}`;
          } else {
            lines.push(`${key}=${value}`);
          }
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
  .argumentWithSuggestions('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"', variableGroupAndEnvironmentCompletions)
  // TODO: completions
  .argument('<key>', 'Key to unset')
  .action(async function(path: string, key: string) {
    const opts = this.opts<SetOptions>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    const client = createTsrClient(instanceUrl);
    const userKeyPair = await UserKeyPair.getInstance();
    
    try {
      if (!key.trim()) {
        console.error('Error: Key cannot be empty');
        process.exit(1);
      }

      // First get the environment to get the decryption data
      const envResponse = await client.environments.getEnvironments({
        query: {
          path: environmentPath.toString(),
          pubkey: userKeyPair.publicKey.toBase64(),
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
        const dek = userKeyPair.unwrapKey({
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
        const entries = parseEnv(currentContent) as Record<string, string>;

        // Check that the key exists
        if (!entries[key]) {
          console.error(`Error: Key ${key} not found in environment`);
          process.exit(1);
        }
        delete entries[key];

        // Encrypt the updated content
        const encryptedContent = dek.encryptContent(Object.entries(entries).map(([key, value]) => `${key}=${value}`).join('\n'));

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
