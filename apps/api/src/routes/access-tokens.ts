import { TsRestRequest } from "@ts-rest/express";
import { x25519 } from '@noble/curves/ed25519';
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { isUserRequester } from "../types/cast";

export const getAccessTokens = async ({ req }: { req: TsRestRequest<typeof contract.accessTokens.getAccessTokens> }) => {
  // Only users can list their access tokens
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Access tokens cannot list access tokens' }
    };
  }

  const userId = req.requester.userId;

  const tokens = await db.query.accessTokens.findMany({
    where: eq(Schema.accessTokens.createdBy, userId),
    columns: {
      id: true,
      name: true,
      expires: true,
    },
    with: {
      publicKey: true
    }
  });

  return {
    status: 200 as const,
    body: tokens.map(token => ({
      id: token.id,
      name: token.name,
      expiresAt: token.expires,
      pubkeyBase64: token.publicKey.id
    }))
  };
};

export const deleteAccessToken = async ({ req }: { req: TsRestRequest<typeof contract.accessTokens.deleteAccessToken> }) => {
  // Only users can delete access tokens
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Access tokens cannot delete other access tokens' }
    };
  }

  const userId = req.requester.userId;
  const { name } = req.params;

  // Delete the token if it belongs to the user
  return await db.transaction(async (tx) => {
    const [deletedAccessToken] = await tx.delete(Schema.accessTokens)
    .where(
      and(
        eq(Schema.accessTokens.name, name),
        eq(Schema.accessTokens.createdBy, userId)
      )
    ).returning();

    if (!deletedAccessToken) {
      return {
        status: 404 as const,
        body: { message: 'Access token not found' }
      };
    }

    const [deletedPublicKey] = await tx.delete(Schema.publicKeys).where(eq(Schema.publicKeys.id, deletedAccessToken.publicKeyId));
    if (!deletedPublicKey) {
      console.error('Public key not found for access token', deletedAccessToken.id);
    }

    return {
      status: 200 as const,
      body: { message: 'Access token deleted' }
    };
  });
};

export const createAccessToken = async ({ req }: { req: TsRestRequest<typeof contract.accessTokens.createAccessToken> }) => {
  // Only users can create access tokens
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Access tokens cannot create other access tokens' }
    };
  }

  const { name, expiresAt, publicKey: { valueBase64: publicKey, algorithm } } = req.body;

  if (algorithm !== 'ed25519') {
    return {
      status: 400 as const,
      body: { message: 'Only ed25519 keys are supported' }
    }
  }

  let pubKeyBytes: Buffer;
  try {
    pubKeyBytes = Buffer.from(publicKey, 'base64');
    if (pubKeyBytes.length !== 32) {
      throw new Error('Invalid key length');
    }
    // Validate key by attempting point decompression
    x25519.getSharedSecret(new Uint8Array(32), new Uint8Array(pubKeyBytes));
  } catch (e) {
    return {
      status: 400 as const,
      body: { message: 'Invalid x25519 public key format' }
    }
  }

  const userId = req.requester.userId;
  const tokenValue = nanoid(32);

  // Create access token and public key
  const result = await db.transaction(async (tx) => {

    // Create public key
    const publicKeyInsertRows = await tx.insert(Schema.publicKeys).values({
      id: publicKey,
      name: `access-token:${name}`,
      content: pubKeyBytes,
      algorithm: 'ed25519' as const
    
      // Allow using same publickey for multiple access tokens
    }).returning();
    if (publicKeyInsertRows.length === 0) {
      return {
        status: 400 as const,
        body: { message: 'Could not create public key for access token' }
      }
    }

    const accessTokenInsertRows = await tx.insert(Schema.accessTokens).values({
      id: nanoid(),
      name,
      value: tokenValue,
      createdBy: userId,
      expires: expiresAt ? new Date(expiresAt) : null,
      publicKeyId: publicKey
    }).onConflictDoNothing().returning();

    if (accessTokenInsertRows.length === 0) {
      return {
        status: 400 as const,
        body: { message: 'Could not create access token' }
      }
    }

    return {
      status: 201 as const,
      body: { tokenValue }
    };
  });
  return result;
};
