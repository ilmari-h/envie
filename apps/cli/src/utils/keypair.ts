import { readFileSync } from 'fs';
import { ed25519, edwardsToMontgomeryPub } from '@noble/curves/ed25519';
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


export function ed25519PublicKeyToX25519(ed25519PublicKey: Uint8Array): string {
  // Convert ed25519 public key to X25519 for ECDH
  const x25519PublicKey = edwardsToMontgomeryPub(ed25519PublicKey);
  return Buffer.from(x25519PublicKey).toString('base64');
}

export const getUserPublicKey = async () => {

  const keypairPath = getKeypairPath();
  if (!keypairPath) {
    return null;
  }

  const keyPair = readEd25519KeyPair(keypairPath);
  const x25519PublicKey = ed25519PublicKeyToX25519(keyPair.publicKey);
  return x25519PublicKey;

}