import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { db, Schema } from '@repo/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.number().default(3001),
});
const env = envSchema.parse(Bun.env);

const app = express();
app.use(express.json());

const s = initServer();

const router = s.router(contract, {

  getEnvironment: async ({ params: { id } }) => {
    const environment = await db.query.environments.findFirst({
      where: eq(Schema.environments.id, id),
    });
    if (!environment) {
      return {
        status: 404,
        body: { message: 'Environment not found' }
      };
    }
    return {
      status: 200,
      body: environment
    };
  },

  getEnvironments: async () => {
    const environments = await db.query.environments.findMany();
    return {
      status: 200,
      body: environments
    };
  }
});

createExpressEndpoints(contract, router, app);

app.listen(env.PORT, () => {
  console.log(`API server running at http://localhost:${env.PORT}`);
}); 