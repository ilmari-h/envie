import { pgTable, text, uuid, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { users } from './users';
import { organizationRoles } from './organization-roles';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdById: text('created_by_id').references(() => users.id),
  hobby: boolean('hobby').notNull().default(false),
  ...timestamps
}, (t) => ([{
  createdByIdIdx: index('created_by_id_idx').on(t.createdById),
  uniqueName: uniqueIndex('unique_name').on(t.name),
}]));

export type Organization = typeof organizations.$inferSelect;

export const organizationRelations = relations(organizations, ({ many }) => ({
  roles: many(organizationRoles),
}));