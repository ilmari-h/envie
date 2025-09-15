import { pgTable, text, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { Project, projects } from './projects';
import { nanoid, nanoidType, timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentVersions } from './environment-versions';
import { environmentAccess } from './environment-access';
import { environmentVariableGroups } from './environment-variable-groups';

export const environments = pgTable('environments', {
  id: nanoid('id').primaryKey(),
  name: text('name').notNull(),
  freeForm: boolean('free_form').notNull().default(false),

  // This is null if environment is a variable group
  projectId: nanoidType('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  preservedVersions: integer('preserved_versions').notNull().default(100),
  ...timestamps
}, (t) => ([{
  nameAndProjectIdUnique: uniqueIndex('name_and_project_id_unique').on(t.projectId, t.name)
}]));

export type Environment = typeof environments.$inferSelect & {
  project?: Project | null
};

export const environmentRelations = relations(environments, ({ many, one }) => ({
  versions: many(environmentVersions, {
    relationName: 'environment_versions'
  }),
  access: many(environmentAccess),
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id]
  }),

  // What variable groups this environment depends on
  requiresVariableGroups: many(environmentVariableGroups, {
    relationName: 'required_by_environment'
  }),
}));
