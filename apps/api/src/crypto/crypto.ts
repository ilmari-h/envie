import { webcrypto } from "node:crypto";

export const cryptAESGCM = async (encryptionKey: Buffer<ArrayBufferLike>, content: string) => {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey(
    'raw', encryptionKey, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const encryptedContent = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    Buffer.from(content)
  );
  return Buffer.concat([iv, Buffer.from(encryptedContent)]);
}

export const decryptAESGCM = async (encryptionKey: Buffer<ArrayBufferLike>, content: Buffer<ArrayBufferLike>) => { 
  const iv = content.subarray(0, 12);
  const encryptedContent = content.subarray(12);
  const key = await webcrypto.subtle.importKey(
    'raw', encryptionKey, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const decryptedContent = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedContent
  );
  return Buffer.from(decryptedContent).toString();
}
