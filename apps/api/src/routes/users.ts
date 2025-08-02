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

