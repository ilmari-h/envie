import { createTsrClient } from '../../utils/tsr-client';
import { getInstanceUrl } from '../../utils/config';
import { UserKeyPair, DataEncryptionKey } from '../../crypto';
import { EnvironmentPath } from './environment-path';
import { EnvironmentVersion, EnvironmentWithVersion } from '@repo/rest';
import { parseEnv } from 'node:util';

interface EnvironmentData {
  environment: EnvironmentWithVersion;
  version: EnvironmentVersion;
  decryptionData: {
    wrappedEncryptionKey: string;
    ephemeralPublicKey: string;
  } 
  | null;
  decryptedContent?: Record<string, string >;
}

export async function getEnvironment(
  path: string, 
  decrypt: boolean = false
): Promise<EnvironmentData> {
  const instanceUrl = getInstanceUrl();
  const userKeyPair = await UserKeyPair.getInstance();
  const environmentPath = new EnvironmentPath(path);
  
  const client = createTsrClient(instanceUrl);
  
  // Get the specific environment using the path
  const response = await client.environments.getEnvironments({
    query: {
      path: environmentPath.toString(),
      version: environmentPath.version?.toString(),
      pubkey: userKeyPair.publicKey.toBase64()
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to fetch environment: ${response.status}`);
  }

  if (response.body.length === 0) {
    throw new Error('Environment not found');
  }

  const environment = response.body[0];
  
  if (!environment.version) {
    throw new Error('Version not found');
  }

  const decryptionData = environment.decryptionData;
  if (!decryptionData) {
    throw new Error('Decryption data not found');
  }

  let decryptedContent: string | undefined;
  
  if (decrypt) {
    const dek = userKeyPair.unwrapKey({
      wrappedKey: decryptionData.wrappedEncryptionKey,
      ephemeralPublicKey: decryptionData.ephemeralPublicKey
    });

    decryptedContent = dek.decryptContent(environment.version.content);
  }

  return {
    environment,
    version: environment.version,
    decryptionData,
    decryptedContent: decryptedContent
      ? parseEnv(decryptedContent) as Record<string, string>
      : undefined
  };
}
