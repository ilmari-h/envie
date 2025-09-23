import { TsRestRequest } from "@ts-rest/express";
import { ed25519 } from '@noble/curves/ed25519';

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { isUserRequester } from "../types/cast";
import { getAccessTokenByNameOrId, getUserByNameOrId } from "../queries/user";
import { getEnvironmentByPath } from "../queries/by-path";

const MAX_USER_PUBLIC_KEYS = 5;

export const getPublicKeys = async ({
  params: { userOrTokenNameOrId }
}: {
  params: TsRestRequest<typeof contract.publicKeys.getPublicKeys>['params']
}) => {
  // Try to find user first
  const targetUser = await getUserByNameOrId(userOrTokenNameOrId);
  if (targetUser?.userPublicKeys.length) {
    return {
      status: 200 as const,
      body: {
        publicKeys: targetUser.userPublicKeys.map(upk => (
        {
        valueBase64: upk.publicKey.id,
        algorithm: upk.publicKey.algorithm
      }
      ))
    }
    };
  }

  // If no user found or no key, try access token
  const targetToken = await getAccessTokenByNameOrId(userOrTokenNameOrId);
  if (targetToken?.publicKey) {
    return {
      status: 200 as const,
      body: {
        publicKeys: [{
          valueBase64: targetToken.publicKey.id,
          algorithm: targetToken.publicKey.algorithm
        }]
      }
    };
  }

  return {
    status: 404 as const,
    body: { message: 'No public key found for this user or token' }
  };
};

export const setPublicKey = async ({ req }: { req: TsRestRequest<typeof contract.publicKeys.setPublicKey> }) => {
  const { publicKey: { valueBase64: publicKey, algorithm, name }, existingEnvironmentAccessForNewKey } = req.body;

  if(algorithm !== 'ed25519') {
    return {
      status: 400 as const,
      body: { message: 'Only ed25519 keys are supported' }
    }
  }

  if (!publicKey) {
    return {
      status: 400 as const,
      body: { message: 'Public key is required' }
    }
  }

  let pubKeyBytes: Buffer;
  try {
    pubKeyBytes = Buffer.from(publicKey, 'base64');
    if (pubKeyBytes.length !== 32) {
      throw new Error('Invalid key length');
    }
    // Validate by ensuring it's a valid curve point
    const testPoint = ed25519.Point.fromHex(pubKeyBytes);
    // Additional check: ensure it's not the identity/zero point
    if (testPoint.equals(ed25519.Point.ZERO)) {
      throw new Error('Invalid key: zero point');
    }
  } catch (e) {
    return {
      status: 400 as const,
      body: { message: 'Invalid ed25519 public key format' }
    }
  }

  // For users
  if(isUserRequester(req.requester)) {
    const userId = req.requester.userId;

    // Check if the public key is already set
    const user = await getUserByNameOrId(userId);
    if ((user?.userPublicKeys.length ?? 0) >= MAX_USER_PUBLIC_KEYS) {
      return {
        status: 400 as const,
        body: { message: `Maximum number of public keys (${MAX_USER_PUBLIC_KEYS}) reached` }
      }
    }

    // Check if there are existing environment access entries
    const existingEnvironmentAccess = await db.query.environmentAccess.findMany({
      where: eq(Schema.environmentAccess.userId, userId)
    });
    if (existingEnvironmentAccess.length > 0
      && existingEnvironmentAccessForNewKey?.length !== existingEnvironmentAccess.length) {
        if(!existingEnvironmentAccessForNewKey?.length) {
          return {
            status: 400 as const,
            body: { message: 'Missing new decryption data' }
          }
        }

        return {
          status: 400 as const,
          body: { message: `Provided ${existingEnvironmentAccessForNewKey?.length} decryption data, but ${existingEnvironmentAccess.length} required` }
        }
    }

    // Create new public key
    await db.transaction(async (tx) => {
       await tx.insert(Schema.publicKeys).values({
        id: publicKey,
        name,
        algorithm: 'ed25519',
        content: pubKeyBytes
      }).onConflictDoNothing()

      await tx.insert(Schema.userPublicKeys).values({
        userId,
        publicKeyId: publicKey
      }).onConflictDoNothing();
    });

    // Add decryption data for existing environment access entries
    if (existingEnvironmentAccessForNewKey?.length) {
      // Find environment access IDs by userId and environment IDs
      const environmentAccessIds = await db.query.environmentAccess.findMany({
        where: eq(Schema.environmentAccess.userId, userId),
        columns: { id: true, environmentId: true }
      });

      // Create mapping of environmentId to access ID
      const envIdToAccessId = new Map(
        environmentAccessIds.map(ea => [ea.environmentId, ea.id])
      );

      // Prepare bulk insert data for environmentDecryptionData
      const decryptionDataToInsert = existingEnvironmentAccessForNewKey.map(data => {
        const accessId = envIdToAccessId.get(data.environmentId);
        if (!accessId) {
          throw new Error(`No environment access found for environment ${data.environmentId}`);
        }
        
        return {
          environmentAccessId: accessId,
          publicKeyId: publicKey,
          ephemeralPublicKey: Buffer.from(data.ephemeralPublicKey, 'base64'),
          encryptedSymmetricKey: Buffer.from(data.encryptedSymmetricKey, 'base64')
        };
      });

      // Bulk insert decryption data
      await db.insert(Schema.environmentDecryptionData).values(decryptionDataToInsert);
    }

  // For access tokens
  } else {
    const accessTokenId = req.requester.accessTokenId;

    // Check if the public key is already set
    const existingAccessToken = await db.query.accessTokens.findFirst({
      where: eq(Schema.accessTokens.id, accessTokenId),
      with: {
        publicKey: true
      }
    });
    if(!existingAccessToken) {
      return {
        status: 400 as const,
        body: { message: 'Access token not found' }
      }
    }

    // Check if it's the same key
    if (Buffer.compare(existingAccessToken.publicKey.content, pubKeyBytes) === 0) {
      return {
        status: 400 as const,
        body: { message: 'Given public key is the same as the one on record' }
      }
    }
    await db.transaction(async (tx) => {
      // Create new public key
       await tx.insert(Schema.publicKeys).values({
        id: publicKey,
        name,
        algorithm: 'ed25519',
        content: pubKeyBytes
      }).onConflictDoNothing()
      
      // Remove old public key
      await tx.delete(Schema.publicKeys).where(eq(Schema.publicKeys.id, existingAccessToken.publicKey.id));

      // Set public key
      await tx.update(Schema.accessTokens).set({
        publicKeyId: publicKey
      }).where(eq(Schema.accessTokens.id, accessTokenId));

      // Delete all environment access entries for old key
      // TODO: allow resetting with new decryption data
      await tx.delete(Schema.environmentAccess).where(eq(Schema.environmentAccess.accessTokenId, accessTokenId));
    });
  }

  return {  
    status: 200 as const,
    body: { message: 'Public key set' }
  }
}

export const getDecryptionKeys = async ({
  req,
  params: { pubkeyBase64Url },
  query: { environment: environmentId }
}: {
  req: TsRestRequest<typeof contract.publicKeys.getDecryptionKeys>
  params: TsRestRequest<typeof contract.publicKeys.getDecryptionKeys>['params']
  query: TsRestRequest<typeof contract.publicKeys.getDecryptionKeys>['query']
}) => {

  const pubkeyBytes = Buffer.from(pubkeyBase64Url, 'base64url');
  const pubkey = Buffer.from(pubkeyBytes).toString('base64');

  // Get environment - only view permission (the default) needed
  const [_organization, _project, environment] = environmentId ? await getEnvironmentByPath(environmentId, {
    requester: req.requester
  }) : [null, null, null];

  if (!environment && environmentId) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get the user's own access entry
  const accessEntries = await db.query.environmentAccess.findMany({
    where: and(
      environment ? eq(Schema.environmentAccess.environmentId, environment.id) : undefined,
      isUserRequester(req.requester)
        ? eq(Schema.environmentAccess.userId, req.requester.userId)
        : eq(Schema.environmentAccess.accessTokenId, req.requester.accessTokenId)
    ),
    with: {
      decryptionData: true
    }
  });

  if (!accessEntries || accessEntries.length === 0) {
    return {
      status: 404 as const,
      body: { message: 'No access found for current user' }
    };
  }

  const decryptionData = accessEntries.map(
      ea => ea.decryptionData.map(d => ({
      publicKeyId: d.publicKeyId,
      algorithm: "x25519" as const,
      wrappedDek: d.encryptedSymmetricKey.toString('base64'),
      ephemeralPublicKey: d.ephemeralPublicKey.toString('base64'),
      environmentId: ea.environmentId
    }))
  ).flat().filter(d => d.publicKeyId === pubkey);

  console.log(pubkey);
  console.log(decryptionData);

  return {
    status: 200 as const,
    body: {
      deks: decryptionData
    }
  };
}