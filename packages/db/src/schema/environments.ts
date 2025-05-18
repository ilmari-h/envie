import { pgTable, text, uuid, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentVersions } from './environment-versions';

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  freeForm: boolean('free_form').notNull().default(false),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  preservedVersions: integer('preserved_versions').notNull().default(100),
  ...timestamps
}, (t) => ([{
  nameAndProjectIdUnique: uniqueIndex('name_and_project_id_unique').on(t.projectId, t.name)
}]));

export type Environment = typeof environments.$inferSelect;

export const environmentRelations = relations(environments, ({ many }) => ({
  versions: many(environmentVersions, {
    relationName: 'environment_versions'
  })
}));
