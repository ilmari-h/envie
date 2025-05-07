import { pgTable, text, serial } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projectAccess } from './project-access';
import { environmentAccess } from './envrionment-access';
import { organizationOwners } from './organization-owners';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  ...timestamps
});

export const usersRelations = relations(users, ({ many }) => ({
  projectAccess: many(projectAccess),
  environmentAccess: many(environmentAccess),
  organizationOwners: many(organizationOwners),
}));