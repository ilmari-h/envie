import express from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract, Environment } from '@repo/rest';
import { db, user, usersToProjects } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';

const app = express();
app.use(express.json());

const MOCK_USER_ID = 1; // We'll replace this with real auth later

const s = initServer();

const router = s.router(contract, {
  getEnvironments: async () => {
    // Get all projects the user has access to
    const userProjects = await db.query.usersToProjects.findMany({
      where: eq(usersToProjects.userId, MOCK_USER_ID),
      with: {
        project: {
          with: {
            environments: true
          }
        }
      }
    });

    const envs = userProjects.flatMap((up: UserToProjectWithRelations) => 
      up.project.environments.map((env: Environment) => ({
        ...env,
        project: up.project
      }))
    );

    return {
      status: 200,
      body: envs
    };
  },
  
  getEnvironment: async ({ params: { id } }) => {
    const env = await db.query.environments.findFirst({
      where: and(
        eq(Schema.environments.id, id),
        inArray(
          Schema.environments.projectId,
          db.select({ id: Schema.projects.id })
            .from(Schema.projects)
            .innerJoin(Schema.usersToProjects, eq(Schema.usersToProjects.projectId, Schema.projects.id))
            .where(eq(Schema.usersToProjects.userId, MOCK_USER_ID))
        )
      ),
      with: {
        project: true
      }
    });
    
    if (!env) {
      return {
        status: 404,
        body: { message: 'Environment not found or access denied' }
      };
    }
    
    return {
      status: 200,
      body: env
    };
  }
});

createExpressEndpoints(contract, router, app);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
}); 