import { pgTable, text, serial, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects)
}));

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  organizationId: serial('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id]
  }),
  environments: many(environments),
  users: many(usersToProjects)
}));

export const environments = pgTable('environments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  projectId: serial('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id]
  })
}));

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(usersToProjects)
}));

export const usersToProjects = pgTable('users_to_projects', {
  userId: serial('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: serial('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // e.g., 'admin', 'member'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ([{
  pk: primaryKey(table.userId, table.projectId)
}]));

// Types
export type Organization = InferSelectModel<typeof organizations>;
export type Project = InferSelectModel<typeof projects>;
export type Environment = InferSelectModel<typeof environments>;
export type User = InferSelectModel<typeof users>;
export type UserToProject = InferSelectModel<typeof usersToProjects>;

// Relations types
export type ProjectWithRelations = Project & {
  environments: Environment[];
  organization: Organization;
};

export type UserToProjectWithRelations = UserToProject & {
  project: ProjectWithRelations;
}; 