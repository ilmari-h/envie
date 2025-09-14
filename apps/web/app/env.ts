import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.string().url(),
    APP_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string(),
    STRIPE_TEAM_PRICE_ID: z.string(),
    JWT_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    APP_URL: process.env.APP_URL,
    API_URL: process.env.API_URL,
    JWT_SECRET: process.env.JWT_SECRET,

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_TEAM_PRICE_ID: process.env.STRIPE_TEAM_PRICE_ID,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === '1',
}); 