import { TsRestRequest } from "@ts-rest/express";
import { contract } from "@repo/rest";

export const getMe = async ({ req }: { req: TsRestRequest<typeof contract.user.getUser> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    }
  }

  return {
    status: 200 as const,
    body: {
      id: req.user.id,
      name: req.user.username,
      authMethod: req.user.id.startsWith('github:') ? 'github' : 'email'
    }
  }
}