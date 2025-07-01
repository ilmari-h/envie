import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { publicKeyColumns, timestamps } from "./utils";
import { users } from "./users";

export const accessTokens = pgTable('access_tokens', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').references(() => users.id).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  expires: timestamp('expiry'),
  ...publicKeyColumns,

  ...timestamps
}, (t) => ([
  index('access_token_value_idx').on(t.value),
]));