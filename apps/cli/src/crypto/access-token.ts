import { Ed25519KeyPair } from '../utils/keypair';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';

enum Algorithm {
  Ed25519 = 'Ed25519'
}

// Algorithm mapping
const ALGORITHMS: Algorithm[] = [
  Algorithm.Ed25519
];

// Token format: [version(1)][algo(1)][private_key(32)][token_value(32)] = 66 bytes total
class AccessToken {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  version: number;
  algorithm: typeof ALGORITHMS[number];
  tokenValue: string;

  constructor(tokenValue: string, privateKey: Uint8Array | null = null) {
    if (tokenValue.length !== 32) {
      throw new Error('Token value must be exactly 32 ASCII characters, got ' + tokenValue.length);
    }
    if (privateKey) {
      // Create from existing private key
      if (privateKey.length !== 32) {
        throw new Error('Private key must be exactly 32 bytes');
      }
      this.privateKey = privateKey;
    } else {
      // Generate new keypair
      this.privateKey = ed25519.utils.randomPrivateKey();
    }
    this.tokenValue = tokenValue;
    this.version = 1;
    this.algorithm = ALGORITHMS[0];
    this.publicKey = ed25519.getPublicKey(this.privateKey);
  }

  // Encode token to base64 string
  toString() {
    const buffer = new Uint8Array(66);
    buffer[0] = this.version;
    buffer[1] = ALGORITHMS.indexOf(this.algorithm);
    buffer.set(this.privateKey, 2);
    buffer.set(Buffer.from(this.tokenValue, 'ascii'), 34);
    
    return Buffer.from(buffer).toString('base64url');
  }

  // Parse token from base64 string
  static fromString(tokenString: string) {
    const buffer = Uint8Array.from(Buffer.from(tokenString, 'base64url'));
    
    if (buffer.length !== 66) {
      throw new Error(`Invalid token length: expected 66 bytes, got ${buffer.length}`);
    }
    
    const version = buffer[0];
    const algorithm = buffer[1];
    const privateKey = buffer.slice(2, 34);
    const tokenValue = buffer.slice(34, 66);
    const tokenValueString = Buffer.from(tokenValue).toString('ascii');
    
    // Validate version
    if (version !== 1) {
      throw new Error(`Unsupported token version: ${version}`);
    }
    
    // Validate algorithm
    if (!(ALGORITHMS.length > algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    
    const token = new AccessToken(tokenValueString, privateKey);
    return token;
  }

  // Extract raw keypair bytes
  getKeypair(): Ed25519KeyPair {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey
    };
  }

  // Get token info (for debugging/display)
  getInfo() {
    const encoded = this.toString();
    return {
      version: this.version,
      algorithm: this.algorithm,
      privateKeyHex: bytesToHex(this.privateKey),
      publicKeyHex: bytesToHex(this.publicKey),
      publicKeyBase64: Buffer.from(this.publicKey).toString('base64'),
      tokenValue: this.tokenValue,
      totalBytes: 66,
      encodedLength: encoded.length
    };
  }

}

export { AccessToken };