import { pgTable, text } from 'drizzle-orm/pg-core';
import {  timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentAccess } from './environment-access';
import { organizationRoles } from './organization-roles';
import { userPublicKeys } from './public-keys';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  email: text('email'),
  ...timestamps
});

export const usersRelations = relations(users, ({ many }) => ({
  environmentAccess: many(environmentAccess),
  organizationRoles: many(organizationRoles),
  userPublicKeys: many(userPublicKeys),
}));

export type User = typeof users.$inferSelect;