import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { ed25519PublicKeyToX25519 } from '../utils/keypair';

type AccessTokenOptions = BaseOptions

type CreateAccessTokenOptions = AccessTokenOptions & {
  expiresAt?: string;
};

const rootCmd = new RootCommand();
export const accessTokenCommand = rootCmd.createCommand<AccessTokenOptions>('access-token')
  .alias('at')
  .description('Manage access tokens');

accessTokenCommand
  .command('list')
  .description('List your access tokens')
  .action(async function() {
    const instanceUrl = getInstanceUrl();
    
    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.accessTokens.getAccessTokens({});

      if (response.status !== 200) {
        console.error(`Failed to fetch access tokens: ${response.status}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Name', key: 'name' },
          { header: 'Expires At', key: 'expiresAt' },
        ],
        response.body.map(token => ({
          name: token.name,
          expiresAt: token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never'
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

accessTokenCommand
  .command('delete')
  .description('Delete an access token')
  .argument('<name>', 'Name of the access token to delete')
  .action(async function(name: string) {
    const instanceUrl = getInstanceUrl();
    
    try {

      // Ask for confirmation
      process.stdout.write(chalk.red(`Are you sure you want to delete access token "${name}"? This action cannot be undone. [y/N] `));
      
      const response = await new Promise<string>(resolve => {
        process.stdin.once('data', data => {
          resolve(data.toString().trim().toLowerCase());
        });
      });

      if (response !== 'y') {
        console.log('Operation cancelled.');
        process.exit(0);
      }

      const client = createTsrClient(instanceUrl);
      const deleteResponse = await client.accessTokens.deleteAccessToken({
        params: { name }
      });

      if (deleteResponse.status !== 200) {
        console.error(`Failed to delete access token: ${(deleteResponse.body as { message: string }).message}`);
        process.exit(1);
      }

      console.log(chalk.green('Access token deleted successfully.'));
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

accessTokenCommand
  .command('create')
  .description('Create a new access token')
  .argument('<name>', 'Name of the access token')
  .argument('<public-key>', 'Base64-encoded public key (Ed25519, OpenSSH format or just the key)')
  .option('--expires-at <date>', 'Expiry date in YYYY-MM-DD format')
  .action(async function(name: string, publicKey: string) {
    const opts = this.opts<CreateAccessTokenOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {

      const client = createTsrClient(instanceUrl);
      const response = await client.accessTokens.createAccessToken({
        body: {
          name,
          publicKey: {
            valueBase64: ed25519PublicKeyToX25519(Buffer.from(publicKey, 'base64')),
            algorithm: 'x25519'
          },
          expiresAt: opts.expiresAt
        }
      });

      if (response.status !== 201) {
        console.error(`Failed to create access token: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      console.log(chalk.green(`Access token "${name}" created successfully.`));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
