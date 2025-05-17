import { pgTable, text, uuid, boolean } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { timestamps } from './utils';
import { relations } from 'drizzle-orm';
import { environmentVersions } from './environment-versions';

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  freeForm: boolean('free_form').notNull().default(false),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  ...timestamps
});

export type Environment = typeof environments.$inferSelect;

export const environmentRelations = relations(environments, ({ many }) => ({
  versions: many(environmentVersions, {
    relationName: 'environment_versions'
  })
}));
