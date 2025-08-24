import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentAccess } from './environment-access';
import { organizationRoles } from './organization-roles';
import { userPublicKeys } from './public-keys';
import { organizations } from './organizations';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  maxOrganizations: integer('max_organizations').notNull().default(1),
  maxUsersPerOrganization: integer('max_users_per_organization').notNull().default(1),
  email: text('email'),
  ...timestamps
})

export const usersRelations = relations(users, ({ many }) => ({
  environmentAccess: many(environmentAccess),
  organizationRoles: many(organizationRoles),
  userPublicKeys: many(userPublicKeys),
  createdOrganizations: many(organizations),
}));

export type User = typeof users.$inferSelect;