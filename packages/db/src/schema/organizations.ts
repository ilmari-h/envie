import { pgTable, text, serial, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ...timestamps
});
