import { pgTable, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid, timestamps } from "./utils";
import { variableGroups } from "./variable-groups";
import { environmentVersions } from "./environment-versions";

export const environmentVariableGroups = pgTable('environment_variable_groups', {
  requiredByEnvironmentVersionId: nanoid('required_by_environment_version_id').references(() => environmentVersions.id, { onDelete: 'cascade' }).notNull(),
  
  variableGroupId: nanoid('variable_group_id').references(() => variableGroups.id, { onDelete: 'cascade' }).notNull(),

  ...timestamps
}, (t) => ([{
  pk: primaryKey({ columns: [t.requiredByEnvironmentVersionId, t.variableGroupId] })
}]));

export const environmentVariableGroupRelations = relations(environmentVariableGroups, ({ one }) => ({
  requiredByEnvironmentVersion: one(environmentVersions, {
    fields: [environmentVariableGroups.requiredByEnvironmentVersionId],
    references: [environmentVersions.id],
    relationName: 'applied_to_environment_version'
  }),
  variableGroup: one(variableGroups, {
    fields: [environmentVariableGroups.variableGroupId],
    references: [variableGroups.id],
    relationName: 'variable_group'
  })
}));