import { RootCommand, BaseOptions } from './root';
import { getEnvironment } from './utils/get-environment';
import { spawn } from 'child_process';
import { environmentCompletions } from '../utils/completions';
import { EnvironmentPath } from './utils/environment-path';

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
      const { version, decryptedContent: envVars } = await getEnvironment({ path: new EnvironmentPath(path) }, true);
      
      if (!envVars) {
        console.error('Failed to decrypt environment content');
        process.exit(1);
      }
      
      // Process variable groups and merge with environment variables
      const allVariables: Record<string, string> = {};
      
      // First, add variables from all variable groups
      for (const vg of version.variableGroups ?? []) {
        const { decryptedContent: groupVars } = await getEnvironment({ environmentId: vg.environmentId }, true);
        if (groupVars) {
          Object.assign(allVariables, groupVars);
        }
      }
      
      // Then, add environment variables (these take precedence over group variables)
      Object.assign(allVariables, envVars);
      
      // Prepare environment for child process
      const childEnv = { ...process.env, ...allVariables };
      
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
        console.log(`Environment variables loaded: ${Object.keys(allVariables).join(', ')}`);
        if (version.variableGroups && version.variableGroups.length > 0) {
          console.log(`Variable groups included: ${version.variableGroups.map(vg => vg.name).join(', ')}`);
        }
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
