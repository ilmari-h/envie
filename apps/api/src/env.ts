import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  REDIS_CONNECTION_STRING: z.string(),
  PORT: z.string().or(z.number()).default("3001"),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_CALLBACK_URL: z.string(),

  FRONTEND_URL: z.string(),
});
export const env = envSchema.parse(process.env);