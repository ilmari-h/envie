import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { organizations } from './organizations';
import { users } from './users';
import { relations } from 'drizzle-orm';

export const organizationInvites = pgTable('organization_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  oneTimeUse: boolean('one_time_use').notNull().default(true),
  expiresAt: timestamp('expires_at').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps
});

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [organizationInvites.createdBy],
    references: [users.id],
  })
}));