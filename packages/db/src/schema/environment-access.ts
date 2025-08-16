import { pgTable, uuid, text, boolean, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { bytea, timestamps } from './utils';
import { organizationRoles } from './organization-roles';
import { relations, sql } from 'drizzle-orm';
import { accessTokens } from './access-tokens';

export const algorithmEnum = pgEnum('algorithm', ['X25519', 'rsa']);

export const environmentAccess = pgTable('environment_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  organizationRoleId: uuid('organization_role_id').references(() => organizationRoles.id, { onDelete: 'cascade' }).notNull(),

  // One or the other
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  accessTokenId: text('access_token_id').references(() => accessTokens.id, { onDelete: 'cascade' }),

  encryptedSymmetricKey: bytea('encrypted_symmetric_key').notNull(),
  ephemeralPublicKey: bytea('ephemeral_public_key').notNull(),
  algorithm: algorithmEnum('algorithm').notNull().default('X25519'),

  write: boolean('write').notNull().default(false),
  expiresAt: timestamp('expires_at'),
  ...timestamps
}, (table) => [
  uniqueIndex('unique_environment_access_user').on(table.environmentId, table.userId),
  uniqueIndex('unique_environment_access_token').on(table.environmentId, table.accessTokenId)
]);

export const environmentAccessRelations = relations(environmentAccess, ({ one }) => ({
  environment: one(environments, {
    fields: [environmentAccess.environmentId],
    references: [environments.id]
  }),
}));

export type EnvironmentAccess = typeof environmentAccess.$inferSelect;