import { webcrypto } from "node:crypto";

export const cryptAESGCM = async (encryptionKey: Buffer, content: string) => {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  try {
    const key = await webcrypto.subtle.importKey(
      'raw', 
      encryptionKey,
      { name: 'AES-GCM', length: 256 }, 
      false, 
      ['encrypt']
    );
    const encryptedContent = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      Buffer.from(content)
    );
    return Buffer.concat([iv, Buffer.from(encryptedContent)]);
  } catch (error) {
    console.error("Error encrypting content", error);
    throw error;
  }
}

export const decryptAESGCM = async (encryptionKey: Buffer, content: Buffer) => { 
  const iv = content.subarray(0, 12);
  const encryptedContent = content.subarray(12);
  
  try {
    const key = await webcrypto.subtle.importKey(
      'raw', 
      encryptionKey,
      { name: 'AES-GCM', length: 256 }, 
      false, 
      ['decrypt']
    );
    const decryptedContent = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedContent
    );
    return Buffer.from(decryptedContent).toString();
  } catch (error) {
    console.error("Error decrypting content", error);
    throw error;
  }
}

export const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}