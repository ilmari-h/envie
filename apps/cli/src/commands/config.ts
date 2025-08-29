import { setKeypairPath, setInstanceUrl, getKeypairPath, getInstanceUrl } from '../utils/config';
import { existsSync } from 'fs';
import { RootCommand, BaseOptions, AutocompleteCommand } from './root';
import { createTsrClient } from '../utils/tsr-client';
import { normalizeEd25519PublicKey, readEd25519KeyPair } from '../utils/keypair';
import { UserKeyPair, Ed25519PublicKey } from '../crypto';
import { showPublicKeyWarning } from '../ui/public-key-warning';

const rootCmd = new RootCommand();
export const configCommand = rootCmd.createCommand('config')
  .description('Manage configuration');

const keypairCommand = configCommand
  .commandWithSuggestions('keypair')
  .description('Manage keypair configuration');

keypairCommand
  .commandWithSuggestions('set')
  .argumentWithSuggestions('<keypair-path>', 'Path to the keypair file', async (input) => {
    return ["gisgidgas", "thisisalongargument", "shorterwargument"]
  })
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
  .command('add-pubkey')
  .argument('<pubkey>', 'Base64-encoded public key (Ed25519, OpenSSH format or just the key)')
  .description('Add a new public key to the server')
  .action(async function(pubkey: string) {
    const client = createTsrClient();
    const base64Pubkey = Buffer.from(normalizeEd25519PublicKey(pubkey)).toString('base64');
    const userKeyPair = await UserKeyPair.getInstance();

    const currentPubKey = userKeyPair.publicKey.toBase64Url();
    const allDeks = await client.publicKeys.getDecryptionKeys({
      params: {
        pubkeyBase64Url: currentPubKey
      }
    });

    console.log(allDeks);
    if(allDeks.status !== 200) {
      console.error('Failed to get decryption keys:', (allDeks.body as { message: string }).message);
      process.exit(1);
    }
    const deksWrapped = allDeks.body.deks;
    const deksUnwrapped = deksWrapped.map(dek => {
      return {
        environmentId: dek.environmentId,
        dek: userKeyPair.unwrapKey({
          wrappedKey: dek.wrappedDek,
          ephemeralPublicKey: dek.ephemeralPublicKey,
        }),
      };
    });

    const existingEnvironmentAccessForNewKey = deksUnwrapped.map(dek => {
      const wrappedDek = dek.dek.wrap(new Ed25519PublicKey(base64Pubkey));
      return {
        environmentId: dek.environmentId,
        ephemeralPublicKey: wrappedDek.ephemeralPublicKey,
        encryptedSymmetricKey: wrappedDek.wrappedKey,
      };
    });

    const response = await client.publicKeys.setPublicKey({
      body: {
        publicKey: {
          valueBase64: base64Pubkey,
          algorithm: 'ed25519',
          name: base64Pubkey
        },
        existingEnvironmentAccessForNewKey
      }
    });

    if(response.status !== 200) {
      console.error('Failed to set public key:', (response.body as { message: string }).message);
      process.exit(1);
    }

    console.log('Public key set successfully');
    process.exit(0);
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
        if('publicKeys' in meResponse.body) {
          // Check if there is a mismatch and warn if so
          if(!meResponse.body.publicKeys.some(pk => pk.valueBase64 === publicKeyBase64)) {
            showPublicKeyWarning(
              meResponse.body.publicKeys.map(pk => pk.valueBase64),
              publicKeyBase64
            );
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