import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { db, Schema } from '@repo/db';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { Strategy as GitHubStrategy } from 'passport-github';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { 
  getEnvironments, 
  getEnvironmentVersion,
  createEnvironment, 
  updateEnvironmentContent, 
  updateEnvironmentSettings,
} from './routes/environments';
import { env } from './env';
import { getOrganizations, createOrganization } from './routes/organizations';
import { getProjects, createProject, getProject, updateProject, generateInviteLink, removeUser, removeInviteLinks, deleteProject, getProjectByInvite } from './routes/projects';
import { and, eq } from 'drizzle-orm';
import { getMe } from './routes/users';
const AUTH_COOKIE_NAME = 'envie_token';

const app = express();
app.use(express.json());

// CORS configuration
const corsOptions = {
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept-Encoding']
};
app.use(cors(corsOptions));

app.use(passport.initialize());
app.use(cookieParser(env.JWT_SECRET, {
  decode: decodeURIComponent
}));

const s = initServer();

const getToken = async (req: express.Request) => {
  if (req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  throw new Error('No token provided');
}

const validateJWT = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = await getToken(req);
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
  next();
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
    getEnvironmentVersion: {
      middleware: [validateJWT],
      handler: getEnvironmentVersion
    },
    createEnvironment: {
      middleware: [validateJWT],
      handler: createEnvironment
    },
    updateEnvironmentContent: {
      middleware: [validateJWT],
      handler: updateEnvironmentContent
    },
    updateEnvironmentSettings: {
      middleware: [validateJWT],
      handler: updateEnvironmentSettings
    }
  }),
  organizations: s.router(contract.organizations, {
    getOrganizations: {
      middleware: [validateJWT],
      handler: getOrganizations
    },
    createOrganization: {
      middleware: [validateJWT],
      handler: createOrganization
    }
  }),
  user: s.router(contract.user, {
    getUser: {
      middleware: [validateJWT],
      handler: getMe
    }
  }),
  projects: s.router(contract.projects, {
    getProjects: {
      middleware: [validateJWT],
      handler: getProjects
    },
    createProject: {
      middleware: [validateJWT],
      handler: createProject
    },
    getProject: {
      middleware: [validateJWT],
      handler: getProject
    },
    updateProject: {
      middleware: [validateJWT],
      handler: updateProject
    },
    generateInviteLink: {
      middleware: [validateJWT],
      handler: generateInviteLink
    },
    removeInviteLinks: {
      middleware: [validateJWT],
      handler: removeInviteLinks
    },
    removeUser: {
      middleware: [validateJWT],
      handler: removeUser
    },
    deleteProject: {
      middleware: [validateJWT],
      handler: deleteProject
    },
    getProjectByInvite: {
      handler: getProjectByInvite
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
      name: profile.username || profile.displayName,
      email: profile.emails?.[0]?.value
    }).onConflictDoUpdate({
      target: Schema.users.id,
      set: {
        name: profile.username || profile.displayName,
        email: profile.emails?.[0]?.value
      }
    });

    // If no hobby organization, create one
    const hobbyOrg = await db.query.organizations.findFirst({
      where: and(
        eq(Schema.organizations.hobby, true),
        eq(Schema.organizations.createdById, githubUserId)),
    });

    if (!hobbyOrg) {
      await db.insert(Schema.organizations).values({
        name: 'Personal',
        createdById: githubUserId,
        hobby: true
      });
    }

    return done(null, {
      id: githubUserId,
      username: profile.username || profile.displayName
    });
  }
));

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
  (req, res) => {
    const state = req.query.state as string | undefined;

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

    // Either CLI or web UI login.
    if (state?.startsWith('cli_')) {
      res.redirect(`${env.FRONTEND_URL}/login?token=${token}&cliToken=${state}`);
    } else {
      res.cookie(AUTH_COOKIE_NAME, token);
      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    }
  }
);

createExpressEndpoints(contract, router, app);

app.listen(env.PORT, () => {
  console.log(`API server running at http://localhost:${env.PORT}`);
}); 