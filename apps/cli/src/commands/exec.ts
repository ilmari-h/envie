import { RootCommand, BaseOptions } from './root';
import { getEnvironment } from './utils/get-environment';
import { spawn } from 'child_process';
import { environmentCompletions } from '../utils/completions';

const rootCmd = new RootCommand();
export const execCommand = rootCmd.createCommand<BaseOptions>('exec')
  .description('Execute a command in a shell with environment variables loaded')
  .argumentWithSuggestions('<environment-path>', 'Environment path (or name if rest of the path is specified in envierc.json) or "default" to use user default configured in .envie', environmentCompletions)
  .argument('[command...]', 'Command to run (use -- to separate command arguments)')
  .allowUnknownOption()
  .action(async function(path: string, commandArgs: string[]) {
    const opts = this.opts<BaseOptions>();
    
    try {
      // Get and decrypt the environment
      const { decryptedContent: envVars } = await getEnvironment(path, true);
      
      if (!envVars) {
        console.error('Failed to decrypt environment content');
        process.exit(1);
      }
        
      
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
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
