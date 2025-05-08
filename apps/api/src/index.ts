import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { db, Schema } from '@repo/db';
import { z } from 'zod';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github';
import jwt from 'jsonwebtoken';
import { 
  getEnvironment, 
  getEnvironments, 
  createEnvironment, 
  updateEnvironmentContent, 
  updateEnvironmentAccess 
} from './routes/environments';

const envSchema = z.object({
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.number().default(3001),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_CALLBACK_URL: z.string(),
});
const env = envSchema.parse(process.env);

const app = express();
app.use(express.json());
app.use(passport.initialize());

const s = initServer();

const validateJWT = async (req: express.Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new Error('Invalid token format');
  }

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_SECRET as string) as unknown as { id: string; username: string };
    req.user = decoded;
  } catch (err) {
    throw new Error('Invalid token');
  }
};

const router = s.router(contract, {
  health: s.router(contract.health, {
    getHealth: {
      handler: () => Promise.resolve({
        status: 200 as const,
        body: { status: 'ok' }
      })
    }
  }),
  environments: s.router(contract.environments, {
    getEnvironments: {
      middleware: [validateJWT],
      handler: getEnvironments
    },
    getEnvironment: {
      middleware: [validateJWT],
      handler: getEnvironment
    },
    createEnvironment: {
      middleware: [validateJWT],
      handler: createEnvironment
    },
    updateEnvironmentContent: {
      middleware: [validateJWT],
      handler: updateEnvironmentContent
    },
    updateEnvironmentAccess: {
      middleware: [validateJWT],
      handler: updateEnvironmentAccess
    }
  })
});

passport.use(new GitHubStrategy({
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    // Create user if they don't exist
    const githubUserId = `github:${profile.id}`;
    await db.insert(Schema.users).values({
      id: githubUserId,
      name: profile.displayName,
      email: profile.emails?.[0]?.value
    }).onConflictDoUpdate({
      target: Schema.users.id,
      set: {
        name: profile.displayName,
        email: profile.emails?.[0]?.value
      }
    });

    return done(null, {
      id: githubUserId,
      username: profile.username || profile.displayName
    });
  }
));

// GitHub Auth Routes
app.get('/auth/github',
  passport.authenticate('github', { session: false })
);

app.get('/auth/github/callback', 
  passport.authenticate('github', { session: false }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        username: req.user.username 
      } satisfies Express.User, 
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