import { pgTable, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { bytea, timestamps } from "./utils";
import { users } from "./users";

export const accessTokens = pgTable('access_tokens', {
  id: text('id').primaryKey(),
  value: text('value').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').references(() => users.id).notNull(),
  expires: timestamp('expiry'),
  publicKeyEd25519: bytea('public_key_ed25519').notNull(),

  ...timestamps
}, (t) => ([
  index('access_token_value_idx').on(t.value),
  unique('access_token_name_by_user_unique').on(t.name, t.createdBy)
]));