import { pgTable, text, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { nanoid, nanoidType, timestamps } from './utils';
import { Organization, organizations } from './organizations';
import { relations } from 'drizzle-orm';
import { environments } from './environments';

// Projects represent a collection of environments
// E.g. a project could be "my-app" and have environments "dev", "staging", "production"
export const projects = pgTable('projects', {
  id: nanoid('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: nanoidType('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ...timestamps
}, (t) => ([{
  uniqueName: uniqueIndex('projects_unique_name_organization_id').on(t.organizationId, t.name)
}]));

export type Project = typeof projects.$inferSelect & {
  organization: Organization
};

export const projectRelations = relations(projects, ({ many, one }) => ({
  environments: many(environments),
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id]
  })
}));