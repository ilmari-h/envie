import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { db, Schema } from '@repo/db';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { Strategy as GitHubStrategy } from 'passport-github';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { 
  getEnvironments, 
  createEnvironment, 
  updateEnvironmentContent, 
  updateEnvironmentSettings,
  setEnvironmentAccess,
  getAccessKeys,
  deleteEnvironmentAccess,
} from './routes/environments';
import { env } from './env';
import { getOrganizations, createOrganization, updateOrganization, getOrganization, getOrganizationMembers, createOrganizationInvite, acceptOrganizationInvite, getOrganizationByInvite, updateAccess } from './routes/organizations';
import { getProjects, createProject, getProject, updateProject, deleteProject } from './routes/projects';
import { and, eq, or, gt, isNull } from 'drizzle-orm';
import { getMe, getUserPublicKey, setPublicKey, updateName } from './routes/users';
import { createClient } from "redis";

const AUTH_COOKIE_NAME = 'envie_token';

const app = express();
app.use(express.json());

// CORS configuration
const corsOptions = {
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept-Encoding', 'x-api-key']
};
app.use(cors(corsOptions));

app.use(passport.initialize());
app.use(cookieParser(env.JWT_SECRET, {
  decode: decodeURIComponent
}));

const s = initServer();
const redis = createClient({ url: env.REDIS_CONNECTION_STRING });
await redis.connect();

const getToken = async (req: express.Request) => {
  if (req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null
}

const getApiKey = (req: express.Request) => {
  return req.headers['x-api-key'] as string | undefined;
}

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Try JWT first
  const loginToken = await getToken(req);
  if (loginToken) {
    const decoded = jwt.verify(
      loginToken,
      env.JWT_SECRET as string) as unknown as { userId: string; username: string };
    req.requester = {
      userId: decoded.userId,
      username: decoded.username
    };
    return next();
  }

  // Try API key
  const apiKey = getApiKey(req);
  if (apiKey) {
    const accessToken = await db.query.accessTokens.findFirst({
      where: and(
        eq(Schema.accessTokens.value, apiKey),
        or(
          isNull(Schema.accessTokens.expires),
          gt(Schema.accessTokens.expires, new Date())
        )
      ),
      with: {
        createdByUser: true
      }
    });

    if (accessToken) {
      req.requester = {
        apiKeyId: accessToken.id,
      };
      return next();
    }
  }

  return res.status(401).json({ message: 'Unauthorized' });
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
      middleware: [requireAuth],
      handler: getEnvironments
    },
    createEnvironment: {
      middleware: [requireAuth],
      handler: createEnvironment
    },
    updateEnvironmentContent: {
      middleware: [requireAuth],
      handler: updateEnvironmentContent
    },
    updateEnvironmentSettings: {
      middleware: [requireAuth],
      handler: updateEnvironmentSettings
    },
    setEnvironmentAccess: {
      middleware: [requireAuth],
      handler: setEnvironmentAccess
    },
    deleteEnvironmentAccess: {
      middleware: [requireAuth],
      handler: deleteEnvironmentAccess
    },
    getAccessKeys: {
      middleware: [requireAuth],
      handler: getAccessKeys
    }
  }),
  organizations: s.router(contract.organizations, {
    getOrganizations: {
      middleware: [requireAuth],
      handler: getOrganizations
    },
    getOrganizationMembers: {
      middleware: [requireAuth],
      handler: getOrganizationMembers
    },
    createOrganizationInvite: {
      middleware: [requireAuth],
      handler: createOrganizationInvite
    },
    acceptOrganizationInvite: {
      middleware: [requireAuth],
      handler: acceptOrganizationInvite
    },
    getOrganizationByInvite: {
      handler: getOrganizationByInvite
    },
    updateOrganization: {
      middleware: [requireAuth],
      handler: updateOrganization
    },
    getOrganization: {
      middleware: [requireAuth],
      handler: getOrganization
    },
    createOrganization: {
      middleware: [requireAuth],
      handler: createOrganization
    },
    updateAccess: {
      middleware: [requireAuth],
      handler: updateAccess
    }
  }),
  user: s.router(contract.user, {
    getUser: {
      middleware: [requireAuth],
      handler: getMe
    },
    getUserPublicKey: {
      middleware: [requireAuth],
      handler: getUserPublicKey
    },
    setPublicKey: {
      middleware: [requireAuth],
      handler: setPublicKey
    },
    updateName: {
      middleware: [requireAuth],
      handler: updateName
    }
  }),
  projects: s.router(contract.projects, {
    getProjects: {
      middleware: [requireAuth],
      handler: getProjects
    },
    createProject: {
      middleware: [requireAuth],
      handler: createProject
    },
    getProject: {
      middleware: [requireAuth],
      handler: getProject
    },
    updateProject: {
      middleware: [requireAuth],
      handler: updateProject
    },
    deleteProject: {
      middleware: [requireAuth],
      handler: deleteProject
    },
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
      name: profile.username || profile.displayName,
      email: profile.emails?.[0]?.value
    }).onConflictDoUpdate({
      target: Schema.users.id,
      set: {
        name: profile.username || profile.displayName,
        email: profile.emails?.[0]?.value
      }
    });

    return done(null, {
      id: githubUserId,
      username: profile.username || profile.displayName
    });
  }
));

// Start CLI login
app.get('/auth/cli/nonce', async (req, res, next) => {
  const nonce = `cli_${randomBytes(32).toString('hex')}`;
  await redis.set(
    `cli_login:${nonce}`,
    "requested",
    {expiration: {type: 'EX', value: 60 * 10}}
  );
  res.json({ nonce });
});

// Finish CLI login by getting the token from Redis
app.get('/auth/cli/login', async (req, res, next) => {
  console.log('CLI login', req.query);
  const nonce = req.query.nonce as string | undefined;
  if (!nonce) {
    console.error('No nonce provided', req.query);
    return res.status(400).json({ message: 'No nonce provided' });
  }
  const token = await redis.get(`cli_login:${nonce}`);
  if (!token || token === 'requested') {
    console.error('Invalid nonce', nonce, token);
    return res.status(400).json({ message: 'Invalid nonce' });
  }
  res.json({ token });
});

// GitHub Auth Routes
app.get('/auth/github', (req, res, next) => {
  const cliToken = req.query.cliToken as string | undefined;
  passport.authenticate('github', { 
    session: false, 
    state: cliToken
  })(req, res, next);
});

app.get('/auth/github/callback', 
  passport.authenticate('github', { session: false }),
  async (req, res) => {
    const state = req.query.state as string | undefined;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: (req.user as { id: string }).id, 
        username: (req.user as { username: string }).username 
      } satisfies Express.Requester, 
      env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // Either CLI or web UI login.
    if (state?.startsWith('cli_')) {
      // Set the token in Redis allowing CLI to get it with another request to /auth/cli/login
      await redis.set(`cli_login:${state}`, token, {expiration: {type: 'EX', value: 60 * 10}});
      res.redirect(`${env.FRONTEND_URL}/login/success`);
    } else {
      // Set cookie and redirect to the dashboard
      res.cookie(AUTH_COOKIE_NAME, token);
      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    }
  }
);

createExpressEndpoints(contract, router, app);

app.listen(env.PORT, () => {
  console.log(`API server running at http://localhost:${env.PORT}`);
}); 