import { db, Schema } from '@repo/db';
import { eq, and, or } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';

export const getProjects = async ({ req }: { req: TsRestRequest<typeof contract.projects.getProjects> }) => {
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
  
  // Find organization organization ID where user is the creator or at least in organization-owners
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
      ));
      if (!organizationOwner || organizationOwner.length === 0) {
        return {
          status: 403 as const,
          body: { message: 'Unauthorized' }
        };
      }
  }

  // Create project
  const [project] = await db.insert(Schema.projects)
    .values({
      name,
      description,
      organizationId: organizationId
    })
    .returning();

  if (!project) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create project' }
    };
  }

  // Add creator to project access
  await db.insert(Schema.projectAccess)
    .values({
      projectId: project.id,
      userId: req.user.id
    });

  return {
    status: 201 as const,
    body: project
  };
};
