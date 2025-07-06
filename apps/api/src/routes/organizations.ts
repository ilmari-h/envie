import { db, Schema } from '@repo/db';
import { count, eq, and } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { getOrganization as getOrganizationByPath } from '../queries/by-path';
import { isUserRequester } from '../types/cast';
import { randomBytes } from 'crypto';

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

export const getOrganizationMembers = async ({
  req,
  params: { idOrPath }
}: {
  req: TsRestRequest<typeof contract.organizations.getOrganizationMembers>;
  params: TsRestRequest<typeof contract.organizations.getOrganizationMembers>['params'];
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

  const members = await db.select({
    roleId: Schema.organizationRoles.id,
    userId: Schema.organizationRoles.userId,
    accessTokenId: Schema.organizationRoles.accessTokenId,
    canAddMembers: Schema.organizationRoles.canAddMembers,
    canCreateEnvironments: Schema.organizationRoles.canCreateEnvironments,
    canCreateProjects: Schema.organizationRoles.canCreateProjects,
    canEditProject: Schema.organizationRoles.canEditProject,
    canEditOrganization: Schema.organizationRoles.canEditOrganization,
    userName: Schema.users.name,
    tokenName: Schema.accessTokens.name
  })
    .from(Schema.organizationRoles)
    .leftJoin(Schema.users, eq(Schema.organizationRoles.userId, Schema.users.id))
    .leftJoin(Schema.accessTokens, eq(Schema.organizationRoles.accessTokenId, Schema.accessTokens.id))
    .where(eq(Schema.organizationRoles.organizationId, organization.id));

  const formattedMembers = members.map(member => ({
    id: member.userId || member.accessTokenId || '',
    name: member.userName || member.tokenName || '',
    type: member.userId ? 'user' as const : 'token' as const,
    permissions: {
      canAddMembers: member.canAddMembers,
      canCreateEnvironments: member.canCreateEnvironments,
      canCreateProjects: member.canCreateProjects,
      canEditProject: member.canEditProject,
      canEditOrganization: member.canEditOrganization
    }
  }));

  return {
    status: 200 as const,
    body: formattedMembers
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

export const createOrganizationInvite = async ({
  req,
  params: { idOrPath },
  body: { oneTimeUse, expiresAt }
}: {
  req: TsRestRequest<typeof contract.organizations.createOrganizationInvite>;
  params: TsRestRequest<typeof contract.organizations.createOrganizationInvite>['params'];
  body: TsRestRequest<typeof contract.organizations.createOrganizationInvite>['body'];
}) => {
  console.log('createOrganizationInvite', req.requester);
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Only users can create organization invites' }
    };
  }

  const organization = await getOrganizationByPath(idOrPath, {
    requester: req.requester,
    addMembers: true
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found or insufficient permissions' }
    };
  }

  const token = randomBytes(32).toString('hex');
  const expirationDate = new Date(expiresAt + 'T23:59:59.999Z');

  const [invite] = await db.insert(Schema.organizationInvites)
    .values({
      organizationId: organization.id,
      token,
      oneTimeUse: oneTimeUse ?? true,
      expiresAt: expirationDate,
      createdBy: req.requester.userId
    })
    .returning();

  if (!invite) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create invite' }
    };
  }

  const inviteUrl = `${process.env.FRONTEND_URL}/invites/organization/${token}`;

  return {
    status: 201 as const,
    body: {
      token: invite.token,
      expiresAt: invite.expiresAt,
      inviteUrl
    }
  };
};

export const acceptOrganizationInvite = async ({
  req,
  params: { token }
}: {
  req: TsRestRequest<typeof contract.organizations.acceptOrganizationInvite>;
  params: TsRestRequest<typeof contract.organizations.acceptOrganizationInvite>['params'];
}) => {
  const userId = isUserRequester(req.requester) ? req.requester.userId : null;
  if (!userId) {
    return {
      status: 403 as const,
      body: { message: 'Only users can accept organization invites' }
    };
  }

  return db.transaction(async (tx) => {
    const invite = await tx.query.organizationInvites.findFirst({
      where: eq(Schema.organizationInvites.token, token),
      with: {
        organization: true
      }
    });

    if (!invite || !invite.organization) {
      return {
        status: 404 as const,
        body: { message: 'Invite not found or expired' }
      };
    }

    if (invite.expiresAt < new Date()) {
      return {
        status: 404 as const,
        body: { message: 'Invite has expired' }
      };
    }

    const existingRole = await tx.query.organizationRoles.findFirst({
      where: and(
        eq(Schema.organizationRoles.organizationId, invite.organizationId!),
        eq(Schema.organizationRoles.userId, userId)
      )
    });

    if (existingRole) {
      return {
        status: 409 as const,
        body: { message: 'You are already a member of this organization' }
      };
    }

    await tx.insert(Schema.organizationRoles)
      .values({
        organizationId: invite.organizationId!,
        userId,
        canAddMembers: false,
        canCreateEnvironments: false,
        canCreateProjects: false,
        canEditProject: false,
        canEditOrganization: false
      });

    if (invite.oneTimeUse) {
      await tx.delete(Schema.organizationInvites)
        .where(eq(Schema.organizationInvites.token, token));
    }

    return {
      status: 200 as const,
      body: { message: `Successfully joined organization "${invite.organization.name}"` }
    };
  });
};
