import { setKeypairPath, setInstanceUrl, getKeypairPath, getInstanceUrl } from '../utils/config';
import { existsSync } from 'fs';
import { RootCommand, BaseOptions } from './root';
import { createTsrClient } from '../utils/tsr-client';
import { ed25519PublicKeyToX25519, readEd25519KeyPair } from '../utils/keypair';
import chalk from 'chalk';

const rootCmd = new RootCommand();
export const configCommand = rootCmd.createCommand('config')
  .description('Manage CLI configuration');

const keypairCommand = configCommand
  .command('keypair')
  .description('Manage keypair configuration');

keypairCommand
  .command('set <keypair-path>')
  .description('Set your keypair path on the local machine')
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

keypairCommand
  .command('show')
  .description('Show the public key of your keypair')
  .action(async function() {
    const opts = this.opts<BaseOptions>();
    const client = createTsrClient();
    const currentPath = getKeypairPath();
    
    if (!currentPath) {
      console.error('No keypair set');
      process.exit(1);
    }
    
    try {
      if (opts.verbose) {
        console.log('Reading keypair from: ' + currentPath);
      }
      const { publicKey } = readEd25519KeyPair(currentPath);
      const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

      // Check user pubkey on server if logged in
      try {
        const meResponse = await client.user.getUser();

        // Could be missing login, ignore
        if (meResponse.status !== 200) {
          process.exit(0);
        }
        if('publicKey' in meResponse.body) {
          // Check if there is a mismatch and warn if so
          if(meResponse.body.publicKey !== publicKeyBase64) {
            console.warn(chalk.yellow('Warning: Different public key configured on the server!'));
            console.warn(chalk.yellow('Set the client to use the correct keypair or you will not be able to update or view environments'));
            console.warn(chalk.yellow('Public key on server: ' + meResponse.body.publicKey));
          }
        }
      } catch (error) {
        // Could be missing login, ignore
        if (opts.verbose) {
          console.error('Could not check public key on server:', error instanceof Error ? error.message : error);
        }
        process.exit(0);
      }

      if (opts.verbose) {
        console.log('Current public key (ed25519 base64):');
      }
      console.log(publicKeyBase64);
      process.exit(0);
    } catch (error) {
      if (opts.verbose) {
        console.error('Could not read keypair:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

const instanceUrlCommand = configCommand
  .command('instance-url')
  .description('Manage instance URL configuration');

instanceUrlCommand
  .command('set <instance-url>')
  .description('Set your instance URL on the local machine')
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

instanceUrlCommand
  .command('show')
  .description('Show the currently configured instance URL')
  .action(function() {
    const opts = this.opts<BaseOptions>();
    
    if (opts.verbose) {
      console.log('Retrieving current instance URL...');
    }
    
    const instanceUrl = getInstanceUrl();
    console.log(instanceUrl);
  });

const nameCommand = configCommand
  .command('name')
  .description('Manage display name configuration');

nameCommand
  .command('set <name>')
  .description('Set your display name on the server')
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
      
      console.log(`Display name set to: ${name}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

nameCommand
  .command('show')
  .description('Show display name')
  .action(async function() {
    const opts = this.opts<BaseOptions>();
    const instanceUrl = getInstanceUrl();

    if (opts.verbose) {
      console.log(`Instance URL: ${instanceUrl}`);
    }

    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.user.getUser();

      if (response.status !== 200) {
        console.error(`Failed to get user info: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
      
      if ('name' in response.body) {
        console.log(response.body.name || 'No name set');
      } else {
        console.log('No name set');
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