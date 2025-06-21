import { pgTable, uuid, text, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { timestamps } from "./utils";
import { relations } from "drizzle-orm";

export const organizationRoles = pgTable('organization_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id),

  // Privileges
  canAddMembers: boolean('can_add_members').notNull().default(false),
  canCreateEnvironments: boolean('can_create_environments').notNull().default(false),
  canCreateProjects: boolean('can_create_projects').notNull().default(false),
  canEditProject: boolean('can_edit_project').notNull().default(false),
  canEditOrganization: boolean('can_edit_organization').notNull().default(false),

  ...timestamps
});

export const organizationRolesRelations = relations(organizationRoles, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationRoles.organizationId],
    references: [organizations.id],
  }),
}));
export type OrganizationRole = typeof organizationRoles.$inferSelect;