import { getToken } from './tokens.js';

export class ApiClient {
  constructor(private instanceUrl: string) {}

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = getToken(this.instanceUrl);
    if (!token) {
      throw new Error('No authentication token found. Please run "envie login" first.');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getUser() {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.instanceUrl}/users/me`, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }
    
    return response.json() as Promise<{
      id: string;
      name: string;
      authMethod: 'github' | 'email';
      publicKey: string | null;
      pkeAlgorithm: 'x25519' | 'rsa' | null;
    }>;
  }

  async setPublicKey(publicKey: string, allowOverride = false) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.instanceUrl}/users/me/public-key`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ publicKey, allowOverride })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to set public key: ${error.message || response.statusText}`);
    }
    
    return response.json() as Promise<{ message: string }>;
  }
}