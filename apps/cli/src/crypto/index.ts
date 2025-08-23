import { readFile } from "fs/promises";
import { decryptContent, encryptContent, EncryptedContent, encryptWithKeyExchangeX25519, unwrapKeyX25519, wrapKeyX25519, WrappedKeyX25519 } from "./utils";
import { Ed25519KeyPair, ed25519PublicKeyToX25519, getUserPrivateKey } from "../utils/keypair";
import { ed25519 } from "@noble/curves/ed25519";

export class DataEncryptionKey {
  private key: Uint8Array<ArrayBufferLike>;

  constructor(key: Uint8Array<ArrayBufferLike>) {
    this.key = key; // TODO: check if key is valid
  }

  public static async readFromFile(keyFilePath: string): Promise<DataEncryptionKey> {
    const key = await readFile(keyFilePath, 'utf-8');
    const keyBuffer = Buffer.from(key.trim(), 'base64');
    return new DataEncryptionKey(keyBuffer);
  }

  public decryptContent(ciphertext: string): string {
    return decryptContent(ciphertext, this.key);
  }

  public wrap(publicKey: Ed25519PublicKey): WrappedKeyX25519 {
    return wrapKeyX25519(this.key, publicKey);
  }

  public encryptContent(plaintext: string): EncryptedContent {
    return encryptContent(plaintext, this.key);
  }

  public static newWithPKE(recipients: Ed25519PublicKey[], plaintext: string): {
    encryptedEnvironment: EncryptedContent;
    wrappedKeys: WrappedKeyX25519[];
    dekBase64: string
  } {
    const { encryptedContent, wrappedKeys, dek } = encryptWithKeyExchangeX25519(
      plaintext,
      recipients
    );

    return {
      encryptedEnvironment: encryptedContent,
      wrappedKeys,
      dekBase64: dek
    };
  }
}

export class Ed25519PublicKey {
  private content: Uint8Array<ArrayBufferLike>;

  constructor(pubkey: Uint8Array<ArrayBufferLike> | string) {
    if (typeof pubkey === 'string') {
      this.content = Buffer.from(pubkey, 'base64');
    } else {
      this.content = pubkey;
    }
  }

  public toX25519(): string {
    return ed25519PublicKeyToX25519(this.content);
  }
  
  public toBase64(): string {
    return Buffer.from(this.content).toString('base64');
  }
}

export class UserKeyPair {
  static #instance: UserKeyPair;
  private keyPair: Ed25519KeyPair;
  publicKey: Ed25519PublicKey;

  private constructor(keyPair: Ed25519KeyPair) {
    this.keyPair = keyPair;
    this.publicKey = new Ed25519PublicKey(keyPair.publicKey);
  }

  public static async getInstance(): Promise<UserKeyPair> {
    if (!UserKeyPair.#instance) {
      const keyPair = await getUserPrivateKey();
      if (!keyPair) {
        throw new Error('No key pair found, please set one using "envie config keypair <path>"');
      }
      UserKeyPair.#instance = new UserKeyPair(keyPair);
    }
    return UserKeyPair.#instance;
  }

  public unwrapKey(wrappedKey: Omit<WrappedKeyX25519, 'publicKeyBase64'>): DataEncryptionKey {
    const aesKey = unwrapKeyX25519(wrappedKey, this.keyPair.privateKey);
    return new DataEncryptionKey(aesKey);
  }

  public sign(message: string): { signature: string; algorithm: 'ecdsa'; pubkeyBase64: string } {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = ed25519.sign(messageBytes, this.keyPair.privateKey);
    return {
      signature: Buffer.from(signatureBytes).toString('base64'),
      algorithm: 'ecdsa' as const,
      pubkeyBase64: this.publicKey.toBase64()
    };
  }

}
