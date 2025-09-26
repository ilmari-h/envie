import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid, timestamps } from "./utils";
import { environments } from "./environments";
import { relations } from "drizzle-orm";

// This is just the metadata for a variable group.
// Functionality is in the environments table.
export const variableGroups = pgTable('variable_groups', {
  id: nanoid('id').primaryKey(),

  // The content of the variable group is in the environments table.
  environmentId: nanoid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),

  description: text('description'),
  ...timestamps
}, (t) => ([
  {
    uniqueEnvironmentId: uniqueIndex('unique_environment_id').on(t.environmentId)
  }
]));


export const variableGroupRelations = relations(variableGroups, ({ one }) => ({
  environment: one(environments, {
    fields: [variableGroups.environmentId],
    references: [environments.id]
  })
}));

export type VariableGroup = typeof variableGroups.$inferSelect;