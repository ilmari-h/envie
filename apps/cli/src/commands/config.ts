import { setKeypairPath, setInstanceUrl, getKeypairPath, getInstanceUrl } from '../utils/config';
import { existsSync } from 'fs';
import { RootCommand, BaseOptions } from './root';

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