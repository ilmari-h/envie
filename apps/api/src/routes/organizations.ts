import { db, Schema } from '@repo/db';
import { eq, exists, or } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract, organizations } from '@repo/rest';

export const getOrganizations = async ({ req }: { req: TsRestRequest<typeof contract.organizations.getOrganizations> }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Get organizations where user has access to at least one project
  const orgs = await db.select({ organizations: Schema.organizations })
    .from(Schema.organizations)
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
    );

  return {
    status: 200 as const,
    body: orgs.map(o => o.organizations)
  };
};

export const createOrganization = async ({
  req,
  body: { name }
}: {
  req: TsRestRequest<typeof contract.organizations.createOrganization>;
  body: { name: string }
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization] = await db.insert(Schema.organizations)
    .values({
      name
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
