import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { timestamps } from './utils';
import { organizationRoles } from './organization-roles';
import { relations } from 'drizzle-orm';

export const environmentAccess = pgTable('environment_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  organizationRoleId: uuid('organization_role_id').references(() => organizationRoles.id, { onDelete: 'cascade' }).notNull(),
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