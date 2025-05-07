import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { db, Schema } from '@repo/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface User {
      id?: string;
      username?: string;
    }
  }
}

const envSchema = z.object({
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.number().default(3001),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_CALLBACK_URL: z.string(),
});
const env = envSchema.parse(Bun.env);

const app = express();
app.use(express.json());
app.use(passport.initialize());

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

passport.use(new GitHubStrategy({
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    // Here you can create or find a user in your database
    // For now, we'll just pass the profile
    return done(null, profile);
  }
));

// GitHub Auth Routes
app.get('/auth/github',
  passport.authenticate('github', { session: false })
);

app.get('/auth/github/callback', 
  passport.authenticate('github', { session: false }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: req.user?.id, 
        username: req.user?.username 
      }, 
      env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // Redirect with token or send token directly
    res.redirect(`/login?token=${token}`);
  }
);

createExpressEndpoints(contract, router, app);

app.listen(env.PORT, () => {
  console.log(`API server running at http://localhost:${env.PORT}`);
}); 