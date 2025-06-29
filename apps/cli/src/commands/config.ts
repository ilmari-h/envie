import { Command } from 'commander';
import { setKeypairPath, setInstanceUrl, getKeypairPath, getInstanceUrl } from '../utils/config.js';
import { existsSync } from 'fs';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('keypair <keypair-path>')
  .description('Set your keypair path')
  .action((keypairPath: string) => {
    // Validate that the keypair file exists
    if (!existsSync(keypairPath)) {
      console.error(`Error: Keypair file not found at: ${keypairPath}`);
      console.error('Please ensure the file exists before setting the path.');
      process.exit(1);
    }

    setKeypairPath(keypairPath);
  });

configCommand
  .command('instance-url <instance-url>')
  .description('Set your instance url')
  .action((instanceUrl: string) => {
    // Basic URL validation
    try {
      new URL(instanceUrl);
    } catch (error) {
      console.error(`Error: Invalid URL format: ${instanceUrl}`);
      process.exit(1);
    }

    setInstanceUrl(instanceUrl);
    console.log(`Instance URL set to: ${instanceUrl}`);
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const keypairPath = getKeypairPath();
    const instanceUrl = getInstanceUrl();

    console.log(`Keypair path: ${keypairPath || 'not set'}`);
    console.log(`Instance URL: ${instanceUrl}`);
  });