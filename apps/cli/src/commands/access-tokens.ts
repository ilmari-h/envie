import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { newRandomEd25519KeyPair } from '../utils/keypair';
import { confirm } from '../ui/confirm';
import { tokenCompletions } from '../utils/completions';
import { AccessToken } from '../crypto/access-token';

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
          { header: 'Public Key', key: 'pubkeyBase64' }
        ],
        response.body.map(token => ({
          name: token.name,
          expiresAt: token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never',
          pubkeyBase64: token.pubkeyBase64
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

accessTokenCommand
  .commandWithSuggestions('delete')
  .description('Delete an access token')
  .argumentWithSuggestions('<name>', 'Name of the access token to delete', tokenCompletions)
  .action(async function(name: string) {
    const instanceUrl = getInstanceUrl();
    
    try {

      // Ask for confirmation
      const confirmed = await confirm({
        prompt: `Are you sure you want to delete access token "${name}"? This action cannot be undone.`,
        dangerColor: true
      });

      if (!confirmed) {
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
  .option('--expires-at <date>', 'Expiry date in YYYY-MM-DD format')
  .action(async function(name: string) {
    const opts = this.opts<CreateAccessTokenOptions>();
    const instanceUrl = getInstanceUrl();
    const newRandomKeyPair = newRandomEd25519KeyPair();

    try {

      const client = createTsrClient(instanceUrl);
      const response = await client.accessTokens.createAccessToken({
        body: {
          name,
          publicKey: {
            valueBase64: Buffer.from(newRandomKeyPair.publicKey).toString('base64'),
            algorithm: 'ed25519'
          },
          expiresAt: opts.expiresAt
        }
      });

      if (response.status !== 201) {
        console.error(`Failed to create access token: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      const accessToken = new AccessToken(response.body.tokenValue, newRandomKeyPair.privateKey);

      console.log(chalk.green(`Access token "${name}" created successfully.`));
      console.log(chalk.green(`Copy the token value and store it securely, it will not be shown again:`));
      console.log(accessToken.toString());
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
