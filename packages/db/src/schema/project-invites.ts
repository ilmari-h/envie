import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { projects } from './projects';
import { users } from './users';

export const projectInvites = pgTable('project_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  oneTimeUse: boolean('one_time_use').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps
}); 