import { pgTable, uuid, text, boolean, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { bytea, timestamps } from './utils';
import { relations, sql } from 'drizzle-orm';
import { accessTokens } from './access-tokens';
import { publicKeys } from './public-keys';

export const environmentAccess = pgTable('environment_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),

  // One or the other
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  accessTokenId: text('access_token_id').references(() => accessTokens.id, { onDelete: 'cascade' }),

  write: boolean('write').notNull().default(false),
  expiresAt: timestamp('expires_at'),
  ...timestamps
}, (table) => [
  uniqueIndex('unique_environment_access_user').on(table.environmentId, table.userId),
  uniqueIndex('unique_environment_access_token').on(table.environmentId, table.accessTokenId)
]);

export const environmentDecryptionData = pgTable('environment_decryption_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentAccessId: uuid('environment_access_id').references(() => environmentAccess.id, { onDelete: 'cascade' }).notNull(),
  publicKeyId: text('public_key_id').references(() => publicKeys.id, { onDelete: 'cascade' }).notNull(),

  // X25519
  ephemeralPublicKey: bytea('ephemeral_public_key').notNull(),
  encryptedSymmetricKey: bytea('encrypted_symmetric_key').notNull(),

  ...timestamps
});

export const environmentAccessRelations = relations(environmentAccess, ({ one, many }) => ({
  environment: one(environments, {
    fields: [environmentAccess.environmentId],
    references: [environments.id]
  }),
  decryptionData: many(environmentDecryptionData)
}));

export type EnvironmentAccess = typeof environmentAccess.$inferSelect;
export type EnvironmentDecryptionData = typeof environmentDecryptionData.$inferSelect;