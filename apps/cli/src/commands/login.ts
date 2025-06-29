import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getKeypairPath, getInstanceUrl } from '../utils/config.js';
import { saveToken } from '../utils/tokens.js';
import { readEd25519KeyPair, ed25519PublicKeyToX25519 } from '../utils/keypair.js';
import { ApiClient } from '../utils/api-client.js';

const execAsync = promisify(exec);

export const loginCommand = new Command('login')
  .description('Start browser login flow')
  .action(async (options, command) => {
    const parentOptions = command.parent?.opts() || {};
    const instanceUrl = parentOptions.instanceUrl || getInstanceUrl();
    
    try {
      // Check if keypair is configured
      const keypairPath = getKeypairPath();
      if (!keypairPath) {
        console.error('Error: Keypair path not configured.');
        console.error('Please run: envie config keypair <path-to-your-keypair>');
        process.exit(1);
      }

      console.log('Starting login flow...');
      console.log(`Instance URL: ${instanceUrl}`);
      console.log(`Using keypair: ${keypairPath}`);
      
      // Step 1: Get nonce from server
      const nonceResponse = await fetch(`${instanceUrl}/auth/cli/nonce`);
      if (!nonceResponse.ok) {
        throw new Error(`Failed to get login nonce: ${nonceResponse.status}`);
      }
      
      const { nonce } = await nonceResponse.json() as { nonce: string };
      console.log('Got login nonce, opening browser...');
      
      // Step 2: Open browser with GitHub OAuth + CLI token
      const authUrl = `${instanceUrl}/auth/github?cliToken=${nonce}`;
      await openBrowser(authUrl);
      
      console.log('Please complete the login in your browser...');
      console.log('Waiting for authentication...');
      
      // Step 3: Poll for token
      const token = await pollForToken(instanceUrl, nonce);
      
      // Step 4: Save token
      saveToken(instanceUrl, token);
      console.log('Login successful!');
      
      // Step 5: Check if user has a public key set, if not, send it to the server
      console.log('Checking user profile...');
      const apiClient = new ApiClient(instanceUrl);
      
      try {
        const user = await apiClient.getUser();
        
        if (!user.publicKey) {
          console.log('No public key found, setting up public key...');
          
          // Read and convert keypair
          const keyPair = readEd25519KeyPair(keypairPath);
          const x25519PublicKey = ed25519PublicKeyToX25519(keyPair.publicKey);
          console.log('X25519 public key:', x25519PublicKey);
          
          // Set public key on server
          await apiClient.setPublicKey(x25519PublicKey);
          console.log('Public key configured successfully!');
        } else {
          console.log('Public key already configured.');
        }
      } catch (error) {
        console.warn('Warning: Failed to check/set public key:', error instanceof Error ? error.message : error);
        console.warn('You may need to set your public key manually later.');
      }
      
      console.log('Setup complete!');
      
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
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  const pollInterval = 5000; // 5 seconds
  
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