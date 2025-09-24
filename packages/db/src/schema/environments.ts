import { pgTable, text, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { Project, projects } from './projects';
import { nanoid, nanoidType, timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentVersions } from './environment-versions';
import { environmentAccess } from './environment-access';
import { environmentVariableGroups } from './environment-variable-groups';
import { organizations } from './organizations';

export const environments = pgTable('environments', {
  id: nanoid('id').primaryKey(),
  name: text('name').notNull(),

  // This is null if environment is a variable group
  projectId: nanoidType('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // This is not null only when environment is a variable group
  organizationId: nanoidType('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  ...timestamps
}, (t) => ([
  {
    nameAndProjectIdUnique: uniqueIndex('name_and_project_id_unique').on(t.projectId, t.name).where(sql`${t.projectId} IS NOT NULL`)
  },
  {
    nameAndOrganizationIdUnique: uniqueIndex('name_and_organization_id_unique').on(t.organizationId, t.name).where(sql`${t.organizationId} IS NOT NULL`)
  }
]));

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
  organization: one(organizations, {
    fields: [environments.organizationId],
    references: [organizations.id]
  }),

  // What variable groups this environment depends on
  requiresVariableGroups: many(environmentVariableGroups, {
    relationName: 'required_by_environment'
  }),
}));
