import { pgTable, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { bytea, nanoid, timestamps } from "./utils";
import { users } from "./users";
import { publicKeys } from "./public-keys";
import { relations } from "drizzle-orm";

export const accessTokens = pgTable('access_tokens', {
  id: nanoid('id').primaryKey(),
  value: text('value').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').references(() => users.id).notNull(),
  expires: timestamp('expiry'),
  publicKeyId: text('public_key_id').references(() => publicKeys.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps
}, (t) => ([
  index('access_token_value_idx').on(t.value),
  unique('access_token_name_by_user_unique').on(t.name, t.createdBy)
]));

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  publicKey: one(publicKeys, {
    fields: [accessTokens.publicKeyId],
    references: [publicKeys.id],
  }),
}));

export type AccessToken = typeof accessTokens.$inferSelect;