import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair } from '../crypto';
import { EnvironmentPath } from './utils/environment-path';
import { variableGroupAndEnvironmentCompletions } from '../utils/completions';
import { parseEnv } from 'node:util';

type SetOptions = BaseOptions & {
  instanceUrl?: string;
  from?: string;
};

const rootCmd = new RootCommand();
export const setCommand = rootCmd.createCommand<SetOptions>('set')
  .description('Set environment variables')
  .argumentWithSuggestions('<environment-path>', 'Environment path in format "organization-name:project-name:env-name"', variableGroupAndEnvironmentCompletions)
  .argument('[KEY=VALUE...]', 'Space-separated key=value pairs, or just KEY to clone from --from environment')
  .option('-f, --from <source-env>', 'Source environment path to clone values from (format: "organization:project:env")')
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

      // Parse input - can be KEY=VALUE (literal) or KEY (clone from --from) or KEY=SOURCE_KEY (remap from --from)
      const parsedPairs: Array<{ key: string; value?: string; sourceKey?: string }> = [];
      
      for (const keyValue of keyValuePairs) {
        const equalsIndex = keyValue.indexOf('=');
        
        if (equalsIndex === -1) {
          // Just KEY - requires --from
          const key = keyValue.trim();
          if (!key) {
            console.error('Error: Key cannot be empty');
            process.exit(1);
          }
          if (!opts.from) {
            console.error(`Error: Key "${key}" has no value. Use KEY=VALUE for literal values, or provide --from to clone values`);
            process.exit(1);
          }
          parsedPairs.push({ key, sourceKey: key });
        } else {
          const key = keyValue.substring(0, equalsIndex).trim();
          const valueOrSourceKey = keyValue.substring(equalsIndex + 1);
          
          if (!key) {
            console.error('Error: Key cannot be empty');
            process.exit(1);
          }
          
          if (opts.from) {
            // With --from: KEY=SOURCE_KEY means remap from source environment
            // The value must be a valid source key name
            if (!valueOrSourceKey) {
              console.error(`Error: Key "${key}" has empty source key. Use "KEY" alone to clone with same name, or "KEY=SOURCE_KEY" to remap`);
              process.exit(1);
            }
            parsedPairs.push({ key, sourceKey: valueOrSourceKey });
          } else {
            // Without --from: KEY=VALUE is a literal value
            parsedPairs.push({ key, value: valueOrSourceKey });
          }
        }
      }
      
      // Fetch source environment if --from is specified
      let sourceEnvVars: Record<string, string> = {};
      if (opts.from) {
        try {
          const sourceEnvPath = new EnvironmentPath(opts.from);
          
          const sourceEnvResponse = await client.environments.getEnvironments({
            query: {
              path: sourceEnvPath.toString(),
              pubkey: userKeyPair.publicKey.toBase64()
            }
          });

          if (sourceEnvResponse.status !== 200 || sourceEnvResponse.body.length === 0) {
            console.error(`Error: Source environment "${opts.from}" not found`);
            process.exit(1);
          }

          const sourceEnvironment = sourceEnvResponse.body[0];
          if (!sourceEnvironment.decryptionData) {
            console.error(`Error: No access to source environment "${opts.from}"`);
            process.exit(1);
          }

          // Decrypt source environment
          const sourceDek = userKeyPair.unwrapKey({
            wrappedKey: sourceEnvironment.decryptionData.wrappedEncryptionKey,
            ephemeralPublicKey: sourceEnvironment.decryptionData.ephemeralPublicKey
          });

          let sourceContent = "";
          if (sourceEnvironment.version) {
            sourceContent = sourceDek.decryptContent(sourceEnvironment.version.content);
          }
          
          sourceEnvVars = parseEnv(sourceContent) as Record<string, string>;
          
          if (opts.verbose) {
            console.log(`✓ Loaded source environment: ${opts.from}`);
          }
        } catch (error) {
          console.error(`Error loading source environment: ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      }
      
      // Resolve all values (literal or from source)
      const resolvedPairs: Array<{ key: string; value: string; source?: string }> = [];
      for (const pair of parsedPairs) {
        if (pair.value !== undefined) {
          // Literal value
          resolvedPairs.push({ key: pair.key, value: pair.value });
        } else if (pair.sourceKey) {
          // Clone from source
          const sourceValue = sourceEnvVars[pair.sourceKey];
          if (sourceValue === undefined) {
            console.error(`Error: Key "${pair.sourceKey}" not found in source environment "${opts.from}"`);
            process.exit(1);
          }
          resolvedPairs.push({ 
            key: pair.key, 
            value: sourceValue,
            source: `${opts.from}:${pair.sourceKey}`
          });
        }
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
        for (const { key, value } of resolvedPairs) {
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
