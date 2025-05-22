import { pgTable, uuid, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';
import { timestamps } from './utils';

// Users belong to projects.
// If a user "belongs" to an organization, that just means they have access to some project in it.
export const projectAccess = pgTable('project_access', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role'),
  ...timestamps
}, (t) => ([{
  pk: uniqueIndex('user_per_project_access_unique').on(t.userId, t.projectId)
}]));
