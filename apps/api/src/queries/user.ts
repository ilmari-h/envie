import { db, Schema } from "@repo/db";
import { eq, or } from "drizzle-orm";

export async function getUserByNameOrId(nameOrId: string | null) {
  if(!nameOrId) {
    return null;
  }

  return db.query.users.findFirst({
    where: or(eq(Schema.users.name, nameOrId), eq(Schema.users.id, nameOrId))
  });
}

export async function getAccessTokenByNameOrId(nameOrId: string | null) {
  if(!nameOrId) {
    return null;
  }

  return db.query.accessTokens.findFirst({
    where: or(eq(Schema.accessTokens.name, nameOrId), eq(Schema.accessTokens.id, nameOrId))
  });
}