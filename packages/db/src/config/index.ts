import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as Schema from "../schema";
import path from "node:path";
import { fileURLToPath } from "node:url";
export * as Schema from "../schema";
// Database connection config
const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/envie";

// Client for migrations and queries
export const migrationClient = postgres(connectionString, { max: 1 });

// Client for queries only
export const queryClient = postgres(connectionString);

// Drizzle ORM instance with proper schema typing
export const db = drizzle(queryClient, { schema: Schema });

// Migration function
export async function runMigrations() {
  try {
    console.log("Running migrations...");
    
    const migrationDb = drizzle(migrationClient);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsFolder = path.join(__dirname, "../drizzle");
    
    await migrate(migrationDb, {
      migrationsFolder,
    });
    
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}