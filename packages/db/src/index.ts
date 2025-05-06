import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as Schema from './schema';
export * from './schema'; 

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/envie';

const client = postgres(connectionString);
export const db = drizzle<typeof Schema>(client, { schema: Schema });
export type Database = typeof db; 