import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { bytea, timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { primaryKey } from 'drizzle-orm/pg-core';

export const wrappedUserKeys = pgTable('wrapped_user_keys', {
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  encryptedSymmetricKey: bytea('encrypted_symmetric_key').notNull(),
  ...timestamps
}, (t) => ([{
  pk: primaryKey({ columns: [t.environmentId, t.userId] })
}]));

export const wrappedUserKeysRelations = relations(wrappedUserKeys, ({ one }) => ({
  environment: one(environments, {
    fields: [wrappedUserKeys.environmentId],
    references: [environments.id]
  }),
  user: one(users, {
    fields: [wrappedUserKeys.userId],
    references: [users.id]
  })
}));
