import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { RootCommand, BaseOptions } from './root';
import { DataEncryptionKey, UserKeyPair } from '../crypto';
import { EnvironmentPath } from './utils';
import { spawn } from 'child_process';
import { parseEnv } from 'node:util';
import { environmentCompletions } from '../utils/completions';

type ShellOptions = BaseOptions & {
  ver?: string;
};

const rootCmd = new RootCommand();
export const execCommand = rootCmd.createCommand<ShellOptions>('exec')
  .description('Execute a command in a shell with environment variables loaded')
  .argumentWithSuggestions('<environment-path>', 'Environment path (or name if rest of the path is specified in envierc.json) or "default" to use user default configured in .envie', environmentCompletions)
  .argument('[command...]', 'Command to run (use -- to separate command arguments)')
  .option('-V, --version <version>', 'Version of the environment to load')
  .allowUnknownOption()
  .action(async function(path: string, commandArgs: string[]) {
    const opts = this.opts<ShellOptions>();
    const instanceUrl = getInstanceUrl();
    const userKeyPair = await UserKeyPair.getInstance();
    
    try {
      // Validate environment path format
      const environmentPath = new EnvironmentPath(path);

      const client = createTsrClient(instanceUrl);
      
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

      // Decrypt environment variables
      try {
        const decryptionData = environment.decryptionData;
        if (!decryptionData) {
          console.error('Decryption data not found');
          process.exit(1);
        }

        const dek = (await UserKeyPair.getInstance()).unwrapKey({
            wrappedKey: decryptionData.wrappedEncryptionKey,
            ephemeralPublicKey: decryptionData.ephemeralPublicKey
          });

        const decryptedContent = dek.decryptContent(environment.version.content);
        
        // Parse the decrypted content as environment variables
        const envVars = parseEnv(decryptedContent);
        
        // Prepare environment for child process
        const childEnv = { ...process.env, ...envVars };
        
        // Determine what command to run
        let command: string;
        let args: string[] = [];
        
        if (commandArgs.length === 0) {
          // No command specified, start an interactive shell
          command = process.env.SHELL || '/bin/bash';
        } else {
          // Command specified
          command = commandArgs[0];
          args = commandArgs.slice(1);
        }
        
        if (opts.verbose) {
          console.log(`Running command: ${command} ${args.join(' ')}`);
          console.log(`Environment variables loaded: ${Object.keys(envVars).join(', ')}`);
        }
        
        // Spawn the command with environment variables
        const child = spawn(command, args, {
          env: childEnv,
          stdio: 'inherit',
          shell: false
        });
        
        // Handle process exit
        child.on('close', (code) => {
          process.exit(code ?? 0);
        });
        
        child.on('error', (error) => {
          console.error('Error spawning command:', error.message);
          process.exit(1);
        });
        
      } catch (error) {
        console.error('Error during decryption:', error instanceof Error ? error.message : error);
        process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
