import { db, Schema } from '@repo/db';
import { count, eq } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { getOrganization as getOrganizationByPath } from '../queries/by-path';
import { isUserRequester } from '../types/cast';

export const getOrganizations = async ({ req }: { req: TsRestRequest<typeof contract.organizations.getOrganizations> }) => {

  // Get organizations where user/API key has access to
  const whereClause = isUserRequester(req.requester)
    ? eq(Schema.organizationRoles.userId, req.requester.userId)
    : eq(Schema.organizationRoles.accessTokenId, req.requester.apiKeyId);

  const orgs = await db.select({ 
    organizations: Schema.organizations,
  })
    .from(Schema.organizations)
    .innerJoin(Schema.organizationRoles, eq(Schema.organizations.id, Schema.organizationRoles.organizationId))
    .where(whereClause);

  const orgsWithProjectsCount = await Promise.all(orgs.map(async o => {
    const projectsCount = await db.select({ count: count() })
      .from(Schema.projects)
      .where(eq(Schema.projects.organizationId, o.organizations.id));
    return {
      ...o.organizations,
      projects: projectsCount[0]?.count ?? 0
    }
  }));

  return {
    status: 200 as const,
    body: orgsWithProjectsCount
  };
};

export const createOrganization = async ({
  req,
  body: { name, description }
}: {
  req: TsRestRequest<typeof contract.organizations.createOrganization>;
  body: TsRestRequest<typeof contract.organizations.createOrganization>['body']
}) => {

  // API keys cannot create organizations
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Organization creation only via CLI' }
    };
  }

  const [organization] = await db.insert(Schema.organizations)
    .values({
      name,
      description,
      createdById: req.requester.userId,
    })
    .returning();

  if (!organization) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create organization' }
    };
  }

  await db.insert(Schema.organizationRoles)
    .values({
      organizationId: organization.id,
      userId: req.requester.userId,
      canAddMembers: true,
      canCreateEnvironments: true,
      canCreateProjects: true,
      canEditProject: true,
      canEditOrganization: true
    });

  return {
    status: 201 as const,
    body: organization
  };
};

export const getOrganization = async ({
  req,
  params: { idOrPath },
}: {
  req: TsRestRequest<typeof contract.organizations.getOrganization>;
  params: TsRestRequest<typeof contract.organizations.getOrganization>['params'],
}) => {

  const organization = await getOrganizationByPath(idOrPath, {
    requester: req.requester
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
  params: { idOrPath },
  body: { name, description }
}: {
  req: TsRestRequest<typeof contract.organizations.updateOrganization>;
  params: TsRestRequest<typeof contract.organizations.updateOrganization>['params'];
  body: TsRestRequest<typeof contract.organizations.updateOrganization>['body'];
}) => {

  const organization = await getOrganizationByPath(idOrPath, {
    requester: req.requester,
    editOrganization: true
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found' }
    };
  }


  const [updatedOrganization] = await db.update(Schema.organizations)
    .set({
      name,
      description,
      updatedAt: new Date()
    })
    .where(eq(Schema.organizations.id, organization.id))
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
