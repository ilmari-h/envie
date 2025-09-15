import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { environments } from "./environments";
import { nanoid, timestamps } from "./utils";
import { variableGroups } from "./variable-groups";

export const environmentVariableGroups = pgTable('environment_variable_groups', {
  requiredByEnvironmentId: nanoid('required_by_environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  
  variableGroupId: nanoid('variable_group_id').references(() => variableGroups.id, { onDelete: 'cascade' }).notNull(),

  ...timestamps
}, (t) => ([{
  pk: primaryKey({ columns: [t.requiredByEnvironmentId, t.variableGroupId] })
}]));

export const environmentVariableGroupRelations = relations(environmentVariableGroups, ({ one }) => ({
  requiredByEnvironment: one(environments, {
    fields: [environmentVariableGroups.requiredByEnvironmentId],
    references: [environments.id],
    relationName: 'applied_to_environment'
  }),
  variableGroup: one(variableGroups, {
    fields: [environmentVariableGroups.variableGroupId],
    references: [variableGroups.id],
    relationName: 'variable_group'
  })
}));