import { pgTable, text, serial, timestamp, integer, uuid   } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { organizations } from './organizations';

// Projects represent a collection of environmentscuid
// E.g. a project could be "my-app" and have environments "dev", "staging", "production"
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ...timestamps
});
