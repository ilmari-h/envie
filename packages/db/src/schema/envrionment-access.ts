import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { timestamps } from './utils';

export const environmentAccess = pgTable('environment_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps
});
