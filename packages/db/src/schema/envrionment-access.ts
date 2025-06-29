import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { bytea, timestamps } from './utils';
import { organizationRoles } from './organization-roles';
import { relations } from 'drizzle-orm';

export const algorithmEnum = pgEnum('algorithm', ['X25519', 'rsa']);

export const environmentAccess = pgTable('environment_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  organizationRoleId: uuid('organization_role_id').references(() => organizationRoles.id, { onDelete: 'cascade' }).notNull(),

  encryptedSymmetricKey: bytea('encrypted_symmetric_key').notNull(),
  ephemeralPublicKey: bytea('ephemeral_public_key').notNull(),
  algorithm: algorithmEnum('algorithm').notNull().default('X25519'),

  write: boolean('write').notNull().default(false),
  expiresAt: timestamp('expires_at'),
  ...timestamps
});

export const environmentAccessRelations = relations(environmentAccess, ({ one }) => ({
  environment: one(environments, {
    fields: [environmentAccess.environmentId],
    references: [environments.id]
  }),
}));

export type EnvironmentAccess = typeof environmentAccess.$inferSelect;