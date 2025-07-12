import { x25519 } from '@noble/curves/ed25519';
import { edwardsToMontgomeryPriv } from '@noble/curves/ed25519';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';

export interface WrappedKeyX25519 {
  wrappedKey: string; // Base64 encoded wrapped AES key
  ephemeralPublicKey: string; // Base64 encoded ephemeral public key
}

export interface EncryptedContent {
  ciphertext: string; // Base64 encoded encrypted content
  keys: string[]; // Array of environment variable keys
}

/**
 * Generate a random AES-256 key
 */
export function generateAESKey(): Uint8Array {
  return randomBytes(32); // 256 bits
}

/**
 * Encrypt content using AES-256-GCM
 */
export function encryptContent(content: string, aesKey: Uint8Array): EncryptedContent {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  
  let encrypted = cipher.update(content, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted content + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  
  // Parse keys from content (simple approach - extract keys before = sign)
  const keys = content.split('\n')
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => line.split('=')[0].trim())
    .filter(key => key.length > 0);
  
  return {
    ciphertext: combined.toString('base64'),
    keys
  };
}

/**
 * Decrypt content using AES-256-GCM
 */
export function decryptContent(ciphertextBase64: string, dek: Uint8Array): string {
  const combined = Buffer.from(ciphertextBase64, 'base64');
  
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(-16);
  const encrypted = combined.slice(12, -16);
  
  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Key Derivation Function using HKDF-like approach with SHA-256
 */
export function deriveKey(sharedSecret: Uint8Array, contextInfo: string = 'envie-key-wrapping'): Uint8Array {
  // Simple HKDF-like derivation
  const salt = Buffer.from('envie-salt'); // In production, this should be random/configurable
  const info = Buffer.from(contextInfo);
  
  // HKDF Extract: HMAC(salt, sharedSecret)
  const hmac1 = createHash('sha256');
  hmac1.update(Buffer.concat([salt, Buffer.from(sharedSecret)]));
  const prk = hmac1.digest();
  
  // HKDF Expand: HMAC(prk, info || 0x01)
  const hmac2 = createHash('sha256');
  hmac2.update(Buffer.concat([prk, info, Buffer.from([0x01])]));
  
  return new Uint8Array(hmac2.digest());
}

/**
 * Wrap an AES key using ECDH with ephemeral key pair
 * Algorithm: 
 * 1. Generate ephemeral key pair
 * 2. Perform ECDH with recipient's public key
 * 3. Derive KEK from shared secret
 * 4. Encrypt AES key with KEK using AES-GCM
 */
export function wrapKey(aesKey: Uint8Array, recipientPublicKey: string): WrappedKeyX25519 {
  // Generate ephemeral key pair
  const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  
  // Convert recipient's base64 public key to Uint8Array
  const recipientPubKeyBytes = Buffer.from(recipientPublicKey, 'base64');
  
  // Perform ECDH to get shared secret
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPubKeyBytes);
  
  // Derive Key Encryption Key (KEK) from shared secret
  const kek = deriveKey(sharedSecret);
  
  // Wrap the AES key using AES-GCM with the KEK
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  
  let wrappedKey = cipher.update(aesKey);
  wrappedKey = Buffer.concat([wrappedKey, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + wrapped key + auth tag
  const combined = Buffer.concat([iv, wrappedKey, authTag]);
  
  return {
    wrappedKey: combined.toString('base64'),
    ephemeralPublicKey: Buffer.from(ephemeralPublicKey).toString('base64')
  };
}

export function unwrapKeyX25519(wrappedKeyData: WrappedKeyX25519, userPrivateKey: Uint8Array): Uint8Array {
  // Convert ephemeral public key from base64
  const ephemeralPublicKey = Buffer.from(wrappedKeyData.ephemeralPublicKey, 'base64');
  
  // Convert ed25519 private key to X25519
  const x25519PrivateKey = edwardsToMontgomeryPriv(userPrivateKey);
  // Perform ECDH to get shared secret
  const sharedSecret = x25519.getSharedSecret(x25519PrivateKey, ephemeralPublicKey);
  // Derive the same KEK
  const kek = deriveKey(sharedSecret);
  
  // Unwrap the AES key
  const combined = Buffer.from(wrappedKeyData.wrappedKey, 'base64');
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(-16);
  const wrappedKey = combined.slice(12, -16);
  
  const decipher = createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(authTag);
  
  let unwrappedKey = decipher.update(wrappedKey);
  unwrappedKey = Buffer.concat([unwrappedKey, decipher.final()]);
  
  return new Uint8Array(unwrappedKey);
}

export function encryptWithKeyExchangeX25519(
  content: string, 
  recipientPublicKeys: string[]
): {
  encryptedContent: EncryptedContent;
  wrappedKeys: WrappedKeyX25519[];
  dek: string;
} {
  // Generate a new AES key for this environment
  const aesKey = generateAESKey();
  
  // Encrypt the content
  const encryptedContent = encryptContent(content, aesKey);
  
  // Wrap the AES key for each recipient
  const wrappedKeys = recipientPublicKeys.map(pubKey => wrapKey(aesKey, pubKey));
  
  return {
    encryptedContent,
    wrappedKeys,
    dek: Buffer.from(aesKey).toString('base64')
  };
}