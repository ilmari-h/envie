import { pgTable, serial, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { timestamps } from "./utils";
import { relations } from "drizzle-orm";

export const organizationOwners = pgTable('organization_owners', {
  id: serial('id').primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  ...timestamps
});

export const organizationOwnersRelations = relations(organizationOwners, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationOwners.organizationId],
    references: [organizations.id],
  }),
}));