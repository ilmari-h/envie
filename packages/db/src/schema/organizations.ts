import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...timestamps
});

export type Organization = typeof organizations.$inferSelect;