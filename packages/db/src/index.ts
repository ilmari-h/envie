import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as Schema from './schema';

// Re-export everything from config
export * from './config';
export * from './schema';
export { generateNanoid } from './schema/utils';

export const getDb = (connectionString: string) => {

  const queryClient = postgres(connectionString);
  return drizzle(queryClient, { schema: Schema });
}