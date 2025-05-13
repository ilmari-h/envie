import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { timestamps, bytea } from './utils';
import { projects } from './projects';

export const projectEncryptionKeys = pgTable('project_encryption_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  key: bytea('key').notNull(),
  ...timestamps
});

export type ProjectEncryptionKey = typeof projectEncryptionKeys.$inferSelect;

