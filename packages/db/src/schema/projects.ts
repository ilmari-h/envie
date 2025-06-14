import { pgTable, text, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { organizations } from './organizations';
import { projectAccess } from './project-access';
import { relations } from 'drizzle-orm';
import { environments } from './environments';

// Projects represent a collection of environmentscuid
// E.g. a project could be "my-app" and have environments "dev", "staging", "production"
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ...timestamps
}, (t) => ([{
  uniqueName: uniqueIndex('unique_name').on(t.organizationId, t.name)
}]));

export type Project = typeof projects.$inferSelect;

export const projectRelations = relations(projects, ({ many }) => ({
  projectAccess: many(projectAccess),
  environments: many(environments)
}));