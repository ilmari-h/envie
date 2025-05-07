import { integer, pgTable, serial, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';
import { timestamps } from './utils';

// Users belong to projects.
// If a user "belongs" to an organization, that just means they have access to some project in it.
export const projectAccess = pgTable('project_access', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  projectId: uuid('project_id').references(() => projects.id),
  ...timestamps
});
