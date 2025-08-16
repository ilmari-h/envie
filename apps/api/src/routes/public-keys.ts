import { TsRestRequest } from "@ts-rest/express";
import { ed25519 } from '@noble/curves/ed25519';

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { eq } from "drizzle-orm";
import { isUserRequester } from "../types/cast";
import { getAccessTokenByNameOrId, getUserByNameOrId } from "../queries/user";

export const getPublicKey = async ({
  params: { userOrTokenNameOrId }
}: {
  params: TsRestRequest<typeof contract.publicKeys.getPublicKey>['params']
}) => {
  // Try to find user first
  const targetUser = await getUserByNameOrId(userOrTokenNameOrId);
  if (targetUser?.publicKeyEd25519) {
    return {
      status: 200 as const,
      body: { ed25519PublicKey: Buffer.from(targetUser.publicKeyEd25519).toString('base64') }
    };
  }

  // If no user found or no key, try access token
  const targetToken = await getAccessTokenByNameOrId(userOrTokenNameOrId);
  if (targetToken?.publicKeyEd25519) {
    return {
      status: 200 as const,
      body: { ed25519PublicKey: Buffer.from(targetToken.publicKeyEd25519).toString('base64') }
    };
  }

  return {
    status: 404 as const,
    body: { message: 'No public key found for this user or token' }
  };
};

export const setPublicKey = async ({ req }: { req: TsRestRequest<typeof contract.publicKeys.setPublicKey> }) => {
  const { publicKey: { valueBase64: publicKey, algorithm }, allowOverride } = req.body;

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
    const existingUser = await db.query.users.findFirst({
      where: eq(Schema.users.id, userId)
    });
    if (existingUser?.publicKeyEd25519) {
      if (!allowOverride) {
        return {
          status: 400 as const,
          body: { message: 'Public key already set' }
        }
      }
      // Check if it's the same key
      if (Buffer.compare(existingUser.publicKeyEd25519, pubKeyBytes) === 0) {
        return {
          status: 400 as const,
          body: { message: 'Given public key is the same as the one on record' }
        }
      }
    }

    // Set public key and delete all environment access entries
    await db.transaction(async (tx) => {
      await tx.update(Schema.users).set({
        publicKeyEd25519: pubKeyBytes
      }).where(eq(Schema.users.id, userId));
      await tx.delete(Schema.environmentAccess).where(eq(Schema.environmentAccess.userId, userId));
    });
  
  // For access tokens
  } else {
    const accessTokenId = req.requester.accessTokenId;

    // Check if the public key is already set
    const existingAccessToken = await db.query.accessTokens.findFirst({
      where: eq(Schema.accessTokens.id, accessTokenId)
    });
    if (existingAccessToken?.publicKeyEd25519) {
      if (!allowOverride) {
        return {
          status: 400 as const,
          body: { message: 'Public key already set' }
        }
      }
      // Check if it's the same key
      if (Buffer.compare(existingAccessToken.publicKeyEd25519, pubKeyBytes) === 0) {
        return {
          status: 400 as const,
          body: { message: 'Given public key is the same as the one on record' }
        }
      }
    }
    // Set public key and delete all environment access entries
    await db.transaction(async (tx) => {
      await tx.update(Schema.accessTokens).set({
        publicKeyEd25519: pubKeyBytes
      }).where(eq(Schema.accessTokens.id, accessTokenId));
      await tx.delete(Schema.environmentAccess).where(eq(Schema.environmentAccess.accessTokenId, accessTokenId));
    });
  }

  return {  
    status: 200 as const,
    body: { message: 'Public key set' }
  }
}
