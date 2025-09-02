import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { bytea, nanoid, nanoidType, timestamps } from './utils';
import { environments } from './environments';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const environmentVersions = pgTable('environment_versions', {
  id: nanoid('id').primaryKey(),
  environmentId: nanoidType('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
  encryptedContent: bytea('encrypted_content').notNull(),
  savedBy: text('saved_by').references(() => users.id).notNull(),
  ...timestamps
});

export const environmentVersionKeys = pgTable('environment_version_keys', {
  key: text('key').notNull(),
  environmentVersionId: nanoid('environment_version_id').references(() => environmentVersions.id, { onDelete: 'cascade' }),
  ...timestamps
}, (t) => ([{
  pk: primaryKey({ columns: [t.key, t.environmentVersionId] })
}]));

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
  }),
  author: one(users, {
    fields: [environmentVersions.savedBy],
    references: [users.id]
  })
}));
