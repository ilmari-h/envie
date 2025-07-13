import { TsRestRequest } from "@ts-rest/express";
import { x25519 } from '@noble/curves/ed25519';

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { eq } from "drizzle-orm";
import { isUserRequester } from "../types/cast";
import { getUserByNameOrId } from "../queries/user";

export const getMe = async ({ req }: { req: TsRestRequest<typeof contract.user.getUser> }) => {
  if (!isUserRequester(req.requester)) {
    return {
      status: 200 as const,
      body: { message: 'API key auth' }
    }
  }

  const user = await db.query.users.findFirst({
    where: eq(Schema.users.id, req.requester.userId)
  })
  if(!user) {
    return {
      status: 404 as const,
      body: { message: 'User not found' }
    }
  }

  return {
    status: 200 as const,
    body: {
      id: user.id,
      name: user.name,
      authMethod: req.requester.userId.startsWith('github:') ? 'github' : 'email' as "github" | "email",
      publicKey: user.publicKeyEd25519 ? Buffer.from(user.publicKeyEd25519).toString('base64') : null,
      pkeAlgorithm: user.publicKeyEd25519 ? 'x25519' as const : null
    }
  }
}

export const getUserPublicKey = async ({
  params: { userIdOrName }
}: {
  params: TsRestRequest<typeof contract.user.getUserPublicKey>['params']
}) => {
  const targetUser = await getUserByNameOrId(userIdOrName);

  if (!targetUser?.publicKeyEd25519) {
    return {
      status: 404 as const,
      body: { message: 'No public key set for this user' }
    };
  }

  return {
    status: 200 as const,
    body: { x25519PublicKey: targetUser.publicKeyEd25519.toString('base64') }
  };
};

export const setPublicKey = async ({ req }: { req: TsRestRequest<typeof contract.user.setPublicKey> }) => {

  const { publicKey } = req.body;

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
    // Validate key by attempting point decompression
    x25519.getSharedSecret(new Uint8Array(32), new Uint8Array(pubKeyBytes));
  } catch (e) {
    return {
      status: 400 as const,
      body: { message: 'Invalid x25519 public key format' }
    }
  }

  if(isUserRequester(req.requester)) {
    const userId = req.requester.userId;

    // Check if the public key is already set
    const existingUser = await db.query.users.findFirst({
      where: eq(Schema.users.id, userId)
    });
    if (existingUser?.publicKeyEd25519 && !req.body.allowOverride) {
      return {
        status: 400 as const,
        body: { message: 'Public key already set' }
      }
    }

    // Set public key and delete all environment access entries
    await db.transaction(async (tx) => {
      await tx.update(Schema.users).set({
        publicKeyEd25519: pubKeyBytes
      }).where(eq(Schema.users.id, userId));
      await tx.delete(Schema.environmentAccess).where(eq(Schema.environmentAccess.userId, userId));
    });
  } else {
    const accessTokenId = req.requester.apiKeyId;

    // Check if the public key is already set
    const existingAccessToken = await db.query.accessTokens.findFirst({
      where: eq(Schema.accessTokens.id, accessTokenId)
    });
    if (existingAccessToken?.publicKeyEd25519 && !req.body.allowOverride) {
      return {
        status: 400 as const,
        body: { message: 'Public key already set' }
      }
    }
    // Set public key
    await db.update(Schema.accessTokens).set({
      publicKeyEd25519: pubKeyBytes
    }).where(eq(Schema.accessTokens.id, accessTokenId));
  }
  return {  
    status: 200 as const,
    body: { message: 'Public key set' }
  }

}

export const updateName = async ({ req }: { req: TsRestRequest<typeof contract.user.updateName> }) => {
  const { name } = req.body;
  if(!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Unauthorized' }
    }
  }

  await db.update(Schema.users).set({ name }).where(eq(Schema.users.id, req.requester.userId));
  return {
    status: 200 as const,
    body: { message: 'Name updated' }
  }
}

