import { pgTable, text } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { projectAccess } from './project-access';
import { environmentAccess } from './envrionment-access';
import { organizationOwners } from './organization-owners';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  ...timestamps
});

export const usersRelations = relations(users, ({ many }) => ({
  projectAccess: many(projectAccess),
  environmentAccess: many(environmentAccess),
  organizationOwners: many(organizationOwners),
}));

export type User = typeof users.$inferSelect;