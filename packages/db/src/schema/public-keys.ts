import { pgEnum, pgTable, text, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bytea, timestamps } from './utils';
import { users } from './users';

export const algorithmEnum = pgEnum('algorithm', ['ed25519', 'rsa']);

export const publicKeys = pgTable('public_keys', {
  
  // Key in base64
  id: text('id').primaryKey(),

  // Name of the key for lookup: hostname of the user's machine
  name: text('name').notNull(),

  // Key in bytes
  content: bytea('content').notNull(),

  algorithm: algorithmEnum('algorithm').notNull(),

  ...timestamps
}, (t) => ([
  index('public_key_name_idx').on(t.name)
]));

export const userPublicKeys = pgTable('user_public_keys', {
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  publicKeyId: text('public_key_id').references(() => publicKeys.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps
}, (t) => ([
  unique('user_public_key_unique').on(t.userId, t.publicKeyId),
]));

export const publicKeysRelations = relations(publicKeys, ({ many }) => ({
  userPublicKeys: many(userPublicKeys),
}));

export const userPublicKeysRelations = relations(userPublicKeys, ({ one }) => ({
  user: one(users, {
    fields: [userPublicKeys.userId],
    references: [users.id],
  }),
  publicKey: one(publicKeys, {
    fields: [userPublicKeys.publicKeyId],
    references: [publicKeys.id],
  }),
}));