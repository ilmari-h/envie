import { pgTable, text, serial, integer, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { bytea, timestamps } from './utils';

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  encryptedContent: bytea('encrypted_content').notNull(),
  projectId: integer('project_id').references(() => projects.id),
  ...timestamps
});

export type Environment = typeof environments.$inferSelect;