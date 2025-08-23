import { TsRestRequest } from "@ts-rest/express";

import { contract } from "@repo/rest";
import { Schema } from "@repo/db";
import { db } from "@repo/db";
import { eq } from "drizzle-orm";
import { isUserRequester } from "../types/cast";

export const getMe = async ({ req }: { req: TsRestRequest<typeof contract.user.getUser> }) => {
  if (!isUserRequester(req.requester)) {
    const accessToken = await db.query.accessTokens.findFirst({
      where: eq(Schema.accessTokens.id, req.requester.accessTokenId),
      with: {
        publicKey: true
      }
    })
    if(!accessToken) {
      return {
        status: 404 as const,
        body: { message: 'API key not found' }
      }
    }

    return {
      status: 200 as const,
      body: { 
        id: accessToken.createdBy,
        name: accessToken.name,
        authMethod: 'token' as const,
        publicKeys: [{
          valueBase64: accessToken.publicKey.id,
          name: accessToken.publicKey.name,
          algorithm: accessToken.publicKey.algorithm
        }]
      }
    }
  }

  const user = await db.query.users.findFirst({
    where: eq(Schema.users.id, req.requester.userId),
    with: {
      userPublicKeys: {
        with: {
          publicKey: true
        },
      }
    }
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
      publicKeys: user.userPublicKeys.map(upk => ({
        valueBase64: upk.publicKey.id,
        name: upk.publicKey.name,
        algorithm: upk.publicKey.algorithm
      }))
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

