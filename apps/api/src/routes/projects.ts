import { db, environmentVersions, Schema } from '@repo/db';
import { eq, and } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { webcrypto } from 'node:crypto';

export const getProject = async ({ req, params: { id } }:
  {
    req: TsRestRequest<typeof contract.projects.getProject>,
    params: TsRestRequest<typeof contract.projects.getProject>['params']
  }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const result = await db.select({
    project: Schema.projects,
    users: Schema.users
  })
    .from(Schema.projects)
    .innerJoin(Schema.projectAccess, eq(Schema.projects.id, Schema.projectAccess.projectId))
    .innerJoin(Schema.users, eq(Schema.projectAccess.userId, Schema.users.id))
    .where(and(
      eq(Schema.projects.id, id),
      eq(Schema.projectAccess.userId, req.user.id)
    ));

  if (!result || result.length === 0 || !result[0]?.project) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  return {
    status: 200 as const,
    body: {
      ...result[0].project,
      users: result.map(r => r.users)
    }
  };
}

export const getProjects = async ({ req }:
  { req: TsRestRequest<typeof contract.projects.getProjects> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const projects = await db.select({projects: Schema.projects})
    .from(Schema.projectAccess)
    .innerJoin(Schema.projects, eq(Schema.projectAccess.projectId, Schema.projects.id))
    .where(eq(Schema.projectAccess.userId, req.user.id));

  return {
    status: 200 as const,
    body: projects.map(p => p.projects)
  };
}

export const createProject = async ({ 
  req, 
  body: { name, description, organizationId } 
}: { 
  req: TsRestRequest<typeof contract.projects.createProject>; 
  body: TsRestRequest<typeof contract.projects.createProject>['body']
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }
  
  // User must be creator of organization or owner of organization to create projects
  const organization = await db.query.organizations.findFirst({
    where: and(
      eq(Schema.organizations.createdById, req.user.id),
      eq(Schema.organizations.id, organizationId)
    )
  });
  if (!organization) {
    const organizationOwner = await db.select({organization: Schema.organizations})
      .from(Schema.organizationOwners)
      .innerJoin(Schema.organizations, eq(Schema.organizationOwners.organizationId, Schema.organizations.id))
      .where(and(
        eq(Schema.organizationOwners.userId, req.user.id),
        eq(Schema.organizations.id, organizationId)
      ));
      if (!organizationOwner || organizationOwner.length === 0) {
        return {
          status: 403 as const,
          body: { message: 'Unauthorized' }
        };
      }
  }

  // Create project
  const project = await db.transaction(async (tx) => {
    const [project] = await tx.insert(Schema.projects)
    .values({
      name,
      description,
      organizationId: organizationId
    })
    .returning();
    if(!project) {
      return null
    }

    // Generate and store encryption key
    const randomBytes = webcrypto.getRandomValues(new Uint8Array(32));
    console.log("Random bytes length:", randomBytes.length);
    const key = Buffer.from(randomBytes);
    console.log("Key buffer length:", key.length);
    await tx.insert(Schema.projectEncryptionKeys)
      .values({
        projectId: project.id,
        key
      });

    // Add creator to project access
    await tx.insert(Schema.projectAccess)
      .values({
        projectId: project.id,
        userId: req.user!.id
      });

    return project;
  });

  if (!project) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create project' }
    };
  }

  return {
    status: 201 as const,
    body: project
  };
};
