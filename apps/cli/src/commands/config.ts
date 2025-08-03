import { setKeypairPath, setInstanceUrl, getKeypairPath, getInstanceUrl } from '../utils/config';
import { existsSync } from 'fs';
import { RootCommand, BaseOptions } from './root';
import { createTsrClient } from '../utils/tsr-client';

const rootCmd = new RootCommand();
export const configCommand = rootCmd.createCommand('config')
  .description('Manage CLI configuration');

configCommand
  .command('keypair <keypair-path>')
  .description('Set your keypair path')
  .action(function(keypairPath: string) {
    const opts = this.opts<BaseOptions>();
    
    if (opts.verbose) {
      console.log(`Setting keypair path to: ${keypairPath}`);
    }
    
    if (!existsSync(keypairPath)) {
      console.error(`Error: Keypair file not found at: ${keypairPath}`);
      console.error('Please ensure the file exists before setting the path.');
      process.exit(1);
    }

    setKeypairPath(keypairPath);
    console.log(`Keypair path set to: ${keypairPath}`);
  });

configCommand
  .command('instance-url <instance-url>')
  .description('Set your instance url')
  .action(function(instanceUrl: string) {
    const opts = this.opts<BaseOptions>();
    
    if (opts.verbose) {
      console.log(`Setting instance URL to: ${instanceUrl}`);
    }
    
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
  .command('name <name>')
  .description('Set your display name')
  .action(async function(name: string) {
    const opts = this.opts<BaseOptions>();
    const instanceUrl = getInstanceUrl();

    if (opts.verbose) {
      console.log(`Instance URL: ${instanceUrl}`);
    }

    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.user.updateName({
        body: { name }
      });

      if (response.status !== 200) {
        console.error(`Failed to update name: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(function() {
    const opts = this.opts<BaseOptions>();
    
    if (opts.verbose) {
      console.log('Retrieving current configuration...');
    }
    
    const keypairPath = getKeypairPath();
    const instanceUrl = getInstanceUrl();

    console.log(`Keypair path: ${keypairPath || 'not set'}`);
    console.log(`Instance URL: ${instanceUrl}`);
  });