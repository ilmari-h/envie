import { readFileSync } from 'fs';
import { edwardsToMontgomeryPub } from '@noble/curves/ed25519';
import sshpk from 'sshpk';
import { getKeypairPath } from './config';

export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function readEd25519KeyPair(filePath: string): Ed25519KeyPair {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Parse using sshpk
    const parsedKey = sshpk.parsePrivateKey(content, 'auto');
    
    if (parsedKey.type !== 'ed25519') {
      throw new Error(`Expected ed25519 key, but got ${parsedKey.type}`);
    }

    // Extract raw key material
    const keyParts = (parsedKey.part as unknown) as { A: { data: Uint8Array }, k: { data: Uint8Array } };
    const privateKey = keyParts.k.data;
    const publicKey = keyParts.A.data;
    
    return { privateKey, publicKey };
  } catch (error) {
    throw new Error(`Failed to read keypair from ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}
export function decodeEd25519Base64BlobOpenSshFormat(buffer: Uint8Array) {
  // Convert Uint8Array to Buffer for easier manipulation
  const buf = Buffer.from(buffer);
  let offset = 0;

  const readUInt32 = () => {
    const value = buf.readUInt32BE(offset);
    offset += 4;
    return value;
  };

  const readBytes = (length: number) => {
    const bytes = buf.slice(offset, offset + length);
    offset += length;
    return bytes;
  };

  // Read and verify key type
  const keyTypeLen = readUInt32();
  const keyType = readBytes(keyTypeLen).toString('ascii');
  if (keyType !== 'ssh-ed25519') {
    throw new Error(`Expected ssh-ed25519 key type, got "${keyType}"`);
  }

  // Read the public key bytes
  const pubKeyLen = readUInt32();
  const pubKey = readBytes(pubKeyLen);

  return {
    keyType,
    rawBytes: new Uint8Array(pubKey)
  };
}

// Take base64 or OpenSSH format and return 32 byte key
export function normalizeEd25519PublicKey(base64Pubkey: string | Uint8Array): Uint8Array {
  const buffer = typeof base64Pubkey === 'string' ? Buffer.from(base64Pubkey, 'base64') : base64Pubkey;
  console.log(buffer.length);
  
  // Assume correct format
  if(buffer.length === 32) {
    return buffer;
  }
  // Assume OpenSSH format
  const decoded = decodeEd25519Base64BlobOpenSshFormat(buffer);
  return Buffer.from(decoded.rawBytes);
}

export function ed25519PublicKeyToX25519(ed25519PublicKey: Uint8Array): string {
  const normalized = normalizeEd25519PublicKey(ed25519PublicKey);
  const x25519PublicKey = edwardsToMontgomeryPub(normalized);
  return Buffer.from(x25519PublicKey).toString('base64');
}


export const getUserPrivateKey = async () => {
  const keypairPath = getKeypairPath();
  if (!keypairPath) {
    return null;
  }
  return readEd25519KeyPair(keypairPath);
}