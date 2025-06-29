import { TsRestRequest } from "@ts-rest/express";
import { x25519 } from '@noble/curves/ed25519';

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { eq } from "drizzle-orm";

export const getMe = async ({ req }: { req: TsRestRequest<typeof contract.user.getUser> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    }
  }

  const user = await db.query.users.findFirst({
    where: eq(Schema.users.id, req.user.id)
  });

  return {
    status: 200 as const,
    body: {
      id: req.user.id,
      name: req.user.username,
      authMethod: req.user.id.startsWith('github:') ? 'github' : 'email' as "github" | "email",
      publicKey: user?.publicKeyEd25519 ? Buffer.from(user.publicKeyEd25519).toString('base64') : null,
      pkeAlgorithm: user?.publicKeyEd25519 ? 'x25519' as const : null
    }
  }
}

export const setPublicKey = async ({ req }: { req: TsRestRequest<typeof contract.user.setPublicKey> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    }
  }

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

  // Check if the public key is already set
  const existingUser = await db.query.users.findFirst({
    where: eq(Schema.users.id, req.user.id)
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
    }).where(eq(Schema.users.id, req.user!.id));
    await tx.delete(Schema.environmentAccess).where(eq(Schema.environmentAccess.userId, req.user!.id));
  });

  return {  
    status: 200 as const,
    body: { message: 'Public key set' }
  }
}