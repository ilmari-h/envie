import { exec } from 'child_process';
import { promisify } from 'util';
import { getKeypairPath, getInstanceUrl } from '../utils/config';
import { saveToken } from '../utils/tokens';
import { createTsrClient } from '../utils/tsr-client';
import { UserKeyPair } from '../crypto';
import { BaseOptions, RootCommand } from './root';
import chalk from 'chalk';

const execAsync = promisify(exec);


export const loginCommand = new RootCommand().createCommand('login')
  .description('Start browser login flow')
  .action(async function() {
    const opts = this.opts<BaseOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      // Check if keypair is configured
      const keypairPath = getKeypairPath();
      if (!keypairPath) {
        console.error('Error: Keypair path not configured.');
        console.error('Please run: envie config keypair <path-to-your-keypair>');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Instance URL: ${instanceUrl}`);
        console.log(`Using keypair: ${keypairPath}`);
      }
      
      // Step 1: Get nonce from server
      const nonceResponse = await fetch(`${instanceUrl}/auth/cli/nonce`);
      if (!nonceResponse.ok) {
        throw new Error(`Failed to get login nonce: ${nonceResponse.status}`);
      }
      
      const { nonce } = await nonceResponse.json() as { nonce: string };
      if (opts.verbose) {
        console.log('Got login nonce, opening browser...');
      }
      
      // Step 2: Open browser with GitHub OAuth + CLI token
      const authUrl = `${instanceUrl}/auth/github?cliToken=${nonce}`;
      await openBrowser(authUrl);
      
      console.log('Please complete the login in your browser...');
      console.log('Waiting for authentication...');
      
      // Step 3: Poll for token
      const token = await pollForToken(instanceUrl, nonce);
      
      // Step 4: Save token
      saveToken(instanceUrl, token);
      console.log(chalk.green('Login successful!'));
      
      // Step 5: Check if user has a public key set, if not, send it to the server
      if (opts.verbose) {
        console.log('Checking user profile...');
      }
      const client = createTsrClient(instanceUrl);
      const userPublicKey = (await UserKeyPair.getInstance()).publicKey.content;
      
      try {
        const userResult = await client.user.getUser();
        
        if (userResult.status !== 200 || 'message' in userResult.body) {
          throw new Error(`Failed to get user info: ${userResult.status}`);
        }
        
        const user = userResult.body;
        
        if (!user.publicKey) {
          if (opts.verbose) {
            console.log('No public key found, setting up public key...');
          }

          // Set public key on server
          const setKeyResult = await client.publicKeys.setPublicKey({
            body: { publicKey: { valueBase64: userPublicKey, algorithm: 'x25519' } }
          });
          
          if (setKeyResult.status !== 200) {
            throw new Error(`Failed to set public key: ${setKeyResult.status}`);
          }
          
          if (opts.verbose) {
            console.log('Public key configured successfully!');
          }
        } else if (user.publicKey !== userPublicKey) {
          console.warn(chalk.yellow('Your local public key does not match the one on the server'))
        }
        if (opts.verbose) {
          console.log("User public key:", user.publicKey);
        }
      } catch (error) {
        console.warn(chalk.yellow('Warning: Failed to check/set public key:', error instanceof Error ? error.message : error));
        console.warn(chalk.yellow('You may need to set your public key manually later.'));
      }
    } catch (error) {
      console.error('Login failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;
  
  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }
  
  try {
    await execAsync(command);
  } catch (error) {
    console.log('Could not open browser automatically.');
    console.log('Please open this URL manually:', url);
  }
}

async function pollForToken(instanceUrl: string, nonce: string): Promise<string> {
  const maxAttempts = 60;
  const pollInterval = 2000; // 2 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${instanceUrl}/auth/cli/login?nonce=${nonce}`);
      
      if (response.ok) {
        const data = await response.json() as { token: string };
        if (data.token) {
          return data.token;
        }
      } else if (response.status === 400) {
        // Still waiting for user to complete auth
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      } else {
        throw new Error(`Unexpected response: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error('Login timeout - please try again');
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error('Login timeout - please try again');
}