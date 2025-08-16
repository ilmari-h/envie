import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { UserKeyPair } from '../crypto';
import { RootCommand, BaseOptions } from './root';
import chalk from 'chalk';

type ResetKeypairOptions = BaseOptions;

const rootCmd = new RootCommand();
export const resetKeypairCommand = rootCmd.createCommand<ResetKeypairOptions>('reset-pubkey')
  .description('Update your public key on the server')
  .action(async function() {
    const opts = this.opts<ResetKeypairOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      // Warning message
      console.log(chalk.red.bold('⚠️  WARNING: This operation is DESTRUCTIVE!'));
      console.log(chalk.red('This will:'));
      console.log(chalk.red('  • Replace your public key on the server'));
      console.log(chalk.red('  • Remove your access to ALL environments'));
      console.log(chalk.red('  • Require access to be granted anew for each environment'));
      console.log('');

      // Ask for confirmation
      process.stdout.write(chalk.red('Are you sure you want to reset your public key? This action cannot be undone. [y/N] '));
      
      const response = await new Promise<string>(resolve => {
        process.stdin.once('data', data => {
          resolve(data.toString().trim().toLowerCase());
        });
      });

      if (response !== 'y') {
        console.log('Operation cancelled.');
        process.exit(0);
      }

      if (opts.verbose) {
        console.log('Getting local public key...');
      }

      // Get local public key
      const userPublicKey = (await UserKeyPair.getInstance()).publicKey;
      
      if (opts.verbose) {
        console.log(`Local public key: ${userPublicKey.toBase64()}`);
        console.log('Updating public key on server...');
      }

      // Update public key on server with override
      const client = createTsrClient(instanceUrl);
      const setKeyResult = await client.publicKeys.setPublicKey({
        body: { 
          publicKey: { 
            valueBase64: userPublicKey.toBase64(), 
            algorithm: 'ed25519' 
          },
          allowOverride: true
        }
      });
      
      if (setKeyResult.status !== 200) {
        console.error(`Failed to reset public key: ${setKeyResult.status}`);
        console.error((setKeyResult.body as { message: string }).message);
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Public key reset successfully!'));
      console.log(chalk.yellow('⚠️  You will need to request access to environments again.'));
      process.exit(0);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
