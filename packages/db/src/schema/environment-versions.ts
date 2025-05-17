import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { bytea, timestamps } from './utils';
import { environments } from './environments';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const environmentVersions = pgTable('environment_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').references(() => environments.id),
  encryptedContent: bytea('encrypted_content').notNull(),
  savedBy: text('saved_by').references(() => users.id).notNull(),
  ...timestamps
});

// Only available for non-free-form environments
// Allows text search on keys
export const environmentVersionKeys = pgTable('environment_version_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentVersionId: uuid('environment_version_id').references(() => environmentVersions.id),
  key: text('key').notNull(),
  ...timestamps
});

export type EnvironmentVersion = typeof environmentVersions.$inferSelect;
export type EnvironmentVersionKey = typeof environmentVersionKeys.$inferSelect;

export const environmentVersionKeyRelations = relations(environmentVersionKeys, ({ one }) => ({
  version: one(environmentVersions, {
    fields: [environmentVersionKeys.environmentVersionId],
    references: [environmentVersions.id]
  })
}));

export const environmentVersionRelations = relations(environmentVersions, ({ many, one }) => ({
  keys: many(environmentVersionKeys),
  environment: one(environments, {
    fields: [environmentVersions.environmentId],
    references: [environments.id],
    relationName: 'environment_versions'
  })
}));
