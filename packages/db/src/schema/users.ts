import { pgTable, text } from 'drizzle-orm/pg-core';
import { bytea, timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentAccess } from './envrionment-access';
import { organizationRoles } from './organization-roles';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  publicKeyEd25519: bytea('public_key_ed25519'),
  email: text('email'),
  ...timestamps
});

export const usersRelations = relations(users, ({ many }) => ({
  environmentAccess: many(environmentAccess),
  organizationRoles: many(organizationRoles),
}));

export type User = typeof users.$inferSelect;