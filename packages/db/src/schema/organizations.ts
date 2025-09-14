import { pgTable, text, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { nanoid, generateNanoid, timestamps } from './utils';
import { users } from './users';
import { organizationRoles } from './organization-roles';
import { relations } from 'drizzle-orm';
import { projects } from './projects';

export const organizations = pgTable('organizations', {
  id: nanoid('id').primaryKey(),
  name: text('name').notNull().default(generateNanoid()),
  description: text('description'),
  createdById: text('created_by_id').references(() => users.id).notNull(),
  ...timestamps
}, (t) => ([{
  createdByIdIdx: index('created_by_id_idx').on(t.createdById),
  uniqueName: uniqueIndex('unique_name').on(t.name),
}]));

export type Organization = typeof organizations.$inferSelect;

export const organizationRelations = relations(organizations, ({ many, one }) => ({
  roles: many(organizationRoles),
  createdBy: one(users, {
    fields: [organizations.createdById],
    references: [users.id]
  }),
  projects: many(projects),
}));