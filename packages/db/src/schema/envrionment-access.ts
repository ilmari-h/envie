import { pgTable, serial, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { environments } from './environments';
import { timestamps } from './utils';
export const environmentAccess = pgTable('environment_access', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  environmentId: uuid('environment_id').references(() => environments.id),
  ...timestamps
});
