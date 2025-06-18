import { db, Schema } from '@repo/db';
import { eq, exists, or, sql } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract, organizations } from '@repo/rest';

export const getOrganizationIdByName = async (name: string) => {
  const [organization] = await db.select({ id: Schema.organizations.id })
    .from(Schema.organizations)
    .where( eq(Schema.organizations.name, name))
    .limit(1);
  return organization?.id;
}

export const getOrganizations = async ({ req }: { req: TsRestRequest<typeof contract.organizations.getOrganizations> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Get organizations where user has access to at least one project
  const orgs = await db.select({ 
    organizations: Schema.organizations,
    projects: sql<number>`count(${Schema.projects.id})::int`
  })
    .from(Schema.organizations)
    .leftJoin(Schema.projects, eq(Schema.organizations.id, Schema.projects.organizationId))
    .where(
      or(
        eq(Schema.organizations.createdById, req.user.id),
        exists(
          db.select()
            .from(Schema.projectAccess)
            .innerJoin(Schema.projects, eq(Schema.projects.id, Schema.projectAccess.projectId))
            .where(
              eq(Schema.projectAccess.userId, req.user.id),
            )
        )
      )
    )
    .groupBy(Schema.organizations.id);

  return {
    status: 200 as const,
    body: orgs.map(o => ({ ...o.organizations, projects: o.projects }))
  };
};

export const createOrganization = async ({
  req,
  body: { name, description }
}: {
  req: TsRestRequest<typeof contract.organizations.createOrganization>;
  body: TsRestRequest<typeof contract.organizations.createOrganization>['body']
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization] = await db.insert(Schema.organizations)
    .values({
      name,
      description,
      createdById: req.user.id
    })
    .returning();

  if (!organization) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create organization' }
    };
  }

  return {
    status: 201 as const,
    body: organization
  };
};

export const getOrganization = async ({
  req,
  params: { id },
}: {
  req: TsRestRequest<typeof contract.organizations.getOrganization>;
  params: TsRestRequest<typeof contract.organizations.getOrganization>['params'],
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: (orgs, { eq, or, exists, and }) => and(
      eq(orgs.id, id),
      or(
        // Organization visible if
        // 1. it was created by the user
        // 2. the user has access to a project in the organization
        eq(orgs.createdById, req.user!.id),
        exists(
          db.select()
            .from(Schema.projectAccess)
            .innerJoin(Schema.projects, eq(Schema.projects.id, Schema.projectAccess.projectId))
            .where(
              and(
                eq(Schema.projectAccess.userId, req.user!.id),
                eq(Schema.projects.organizationId, orgs.id)
              )
            )
        ),
      )
    )
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found' }
    };
  }

  return {
    status: 200 as const,
    body: organization
  };
};

export const updateOrganization = async ({
  req,
  params: { id },
  body: { name, description }
}: {
  req: TsRestRequest<typeof contract.organizations.updateOrganization>;
  params: { id: string };
  body: { name: string; description?: string };
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: (orgs, { eq }) => eq(orgs.id, id)
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found' }
    };
  }

  if (organization.createdById !== req.user.id) {
    return {
      status: 403 as const,
      body: { message: 'Only organization owners can update organization details' }
    };
  }

  const [updatedOrganization] = await db.update(Schema.organizations)
    .set({
      name,
      description,
      updatedAt: new Date()
    })
    .where(eq(Schema.organizations.id, id))
    .returning();
  if (!updatedOrganization) {
    return {
      status: 500 as const,
      body: { message: 'Failed to update organization' }
    };
  }

  return {
    status: 200 as const,
    body: updatedOrganization
  };
};
