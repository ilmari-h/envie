import { readFile } from "fs/promises";
import { decryptContent, encryptContent, EncryptedContent, encryptWithKeyExchangeX25519, unwrapKeyX25519, WrappedKeyX25519 } from "./utils";
import { Ed25519KeyPair, ed25519PublicKeyToX25519, getUserPrivateKey } from "../utils/keypair";

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

  public encryptContent(plaintext: string): EncryptedContent {
    return encryptContent(plaintext, this.key);
  }
}

export class X25519PublicKey {
  content: string;

  constructor(content: string) {
    this.content = content;
  }
}

export class UserKeyPair {
  static #instance: UserKeyPair;
  private keyPair: Ed25519KeyPair;
  publicKey: X25519PublicKey;

  private constructor(keyPair: Ed25519KeyPair) {
    this.keyPair = keyPair;
    this.publicKey = new X25519PublicKey(ed25519PublicKeyToX25519(keyPair.publicKey));
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

  public unwrapKey(wrappedKey: WrappedKeyX25519): DataEncryptionKey {
    const aesKey = unwrapKeyX25519(wrappedKey, this.keyPair.privateKey);
    return new DataEncryptionKey(aesKey);
  }

  public encryptWithKeyExchange(recipients: X25519PublicKey[], plaintext: string): {
    encryptedEnvironment: EncryptedContent;
    wrappedKeys: WrappedKeyX25519[];
    dekBase64: string
  } {
    const { encryptedContent, wrappedKeys, dek } = encryptWithKeyExchangeX25519(
      plaintext,
      recipients.map(recipient => recipient.content)
    );

    return {
      encryptedEnvironment: encryptedContent,
      wrappedKeys,
      dekBase64: dek
    };
  }

}
