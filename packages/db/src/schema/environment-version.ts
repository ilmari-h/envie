import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { bytea, timestamps } from './utils';
import { environments } from './environments';
import { relations } from 'drizzle-orm';

export const environmentVersions = pgTable('environment_versions', {
  id: uuid().primaryKey().defaultRandom(),
  environmentId: uuid().references(() => environments.id),
  encryptedContent: bytea().notNull(),
  ...timestamps
});

// Only available for non-free-form environments
// Allows text search on keys
export const environmentVersionKeys = pgTable('environment_version_keys', {
  id: uuid().primaryKey().defaultRandom(),
  environmentVersionId: uuid().references(() => environmentVersions.id),
  key: text().notNull(),
  ...timestamps
});

export type EnvironmentVersion = typeof environmentVersions.$inferSelect;
export type EnvironmentVersionKey = typeof environmentVersionKeys.$inferSelect;

export const environmentVersionRelations = relations(environmentVersions, ({ many }) => ({
  keys: many(environmentVersionKeys)
}));
