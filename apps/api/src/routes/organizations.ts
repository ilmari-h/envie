import { db, generateNanoid, Schema } from '@repo/db';
import { count, eq, and } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { getOrganization as getOrganizationByPath, isValidUUID } from '../queries/by-path';
import { isUserRequester } from '../types/cast';
import { randomBytes } from 'crypto';
import { getUserByNameOrId } from '../queries/user';

export const getOrganizations = async ({ req }: { req: TsRestRequest<typeof contract.organizations.getOrganizations> }) => {

  // Get organizations where user/API key has access to
  const whereClause = isUserRequester(req.requester)
    ? eq(Schema.organizationRoles.userId, req.requester.userId)
    : eq(Schema.organizationRoles.userId, req.requester.accessTokenOwnerId);

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
      body: { message: 'Must be authenticated as a user' }
    };
  }
  const user = await getUserByNameOrId(req.requester.userId);
  if(!user) {
    return {
      status: 400 as const,
      body: { message: 'User not found' }
    };
  }
  if(user.createdOrganizations.length >= user.maxOrganizations) {
    return {
      status: 403 as const,
      body: { message: 'You have reached the maximum number of organizations you can create' }
    };
  }

  const [organization] = await db.insert(Schema.organizations)
    .values({
      name,
      description,
      createdById: req.requester.userId,
    })
    .onConflictDoNothing()
    .returning();

  if (!organization) {
    return {
      status: 500 as const,
      body: { message: 'Organization already exists' }
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
    canAddMembers: Schema.organizationRoles.canAddMembers,
    canCreateEnvironments: Schema.organizationRoles.canCreateEnvironments,
    canCreateProjects: Schema.organizationRoles.canCreateProjects,
    canEditProject: Schema.organizationRoles.canEditProject,
    canEditOrganization: Schema.organizationRoles.canEditOrganization,
    userName: Schema.users.name,
  })
    .from(Schema.organizationRoles)
    .leftJoin(Schema.users, eq(Schema.organizationRoles.userId, Schema.users.id))
    .where(eq(Schema.organizationRoles.organizationId, organization.id));

  const formattedMembers = members.map(member => ({
    id: member.userId,
    name: member.userName ?? '',
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

  const organizationCreator = await db.query.users.findFirst({
    where: eq(Schema.users.id, organization.createdById),

  });
  if(!organizationCreator) {
    return {
      status: 500 as const,
      body: { message: 'Organization creator not found' }
    };
  }

  const [organizationMembersCount] = await db.select({
    count: count()
  }).from(Schema.organizationRoles)
    .where(eq(Schema.organizationRoles.organizationId, organization.id));
  
  if((organizationMembersCount?.count ?? 0) >= organizationCreator.maxUsersPerOrganization) {
    return {
      status: 403 as const,
      body: { message: `This organization has reached maximum amount of ${organizationCreator.maxUsersPerOrganization} members` }
    };
  }

  const token = generateNanoid(24)
  const [invite] = await db.insert(Schema.organizationInvites)
    .values({
      organizationId: organization.id,
      token,
      oneTimeUse: oneTimeUse ?? true,
      expiresAt,
      createdBy: req.requester.userId
    })
    .returning();

  if (!invite) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create invite' }
    };
  }

  const inviteUrl = `${process.env.FRONTEND_URL}/invite?inviteId=${token}`;

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
  params: { name, token }
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
        organization: {
          with: {
            roles: true,
            createdBy: true
          }
        }
      }
    });

    // Check how many users are in the organization and if user can add more members
    const organizationCreator = invite?.organization?.createdBy
    if(!organizationCreator) {
      return {
        status: 500 as const,
        body: { message: 'Organization creator not found' }
      };
    }
    const maxAllowedMembers = organizationCreator.maxUsersPerOrganization;
    if((invite.organization?.roles?.length ?? 0) >= maxAllowedMembers) {
      return {
        status: 403 as const,
        body: { message: `This organization has reached maximum amount of ${maxAllowedMembers} members` }
      };
    }

    if (!invite || !invite.organization) {
      return {
        status: 404 as const,
        body: { message: 'Invite not found or expired' }
      };
    }

    if (invite.organization.name !== name) {
      return {
        status: 404 as const,
        body: { message: 'Organization not found' }
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
        status: 400 as const,
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

export const getOrganizationByInvite = async ({
  params: { token }
}: {
  params: TsRestRequest<typeof contract.organizations.getOrganizationByInvite>['params'];
}) => {
  const invite = await db.query.organizationInvites.findFirst({
    where: eq(Schema.organizationInvites.token, token),
    with: {
      organization: true
    }
  });

  if (!invite || !invite.organization || invite.expiresAt < new Date()) {
    return {
      status: 404 as const,
      body: { message: 'Invite not found or expired' }
    };
  }

  return {
    status: 200 as const,
    body: {
      name: invite.organization.name,
      id: invite.organization.id
    }
  };
};

export const listOrganizationInvites = async ({
  req,
  params: { idOrPath }
}: {
  req: TsRestRequest<typeof contract.organizations.listOrganizationInvites>;
  params: TsRestRequest<typeof contract.organizations.listOrganizationInvites>['params'];
}) => {
  console.log('listOrganizationInvites', req.requester);
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Method not available for API keys' }
    };
  }

  const organization = await getOrganizationByPath(idOrPath, {
    requester: req.requester
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found' }
    };
  }

  // Check if user is organization owner
  const isOwner = organization.createdById === req.requester.userId;

  // Build the where clause based on user role
  const whereClause = isOwner 
    ? eq(Schema.organizationInvites.organizationId, organization.id)
    : and(
        eq(Schema.organizationInvites.organizationId, organization.id),
        eq(Schema.organizationInvites.createdBy, req.requester.userId)
      );

  const invites = await db.query.organizationInvites.findMany({
    where: whereClause,
    with: {
      creator: {
        columns: {
          name: true
        }
      }
    },
    orderBy: (invites, { desc }) => [desc(invites.createdAt)]
  });

  return {
    status: 200 as const,
    body: invites.map(invite => ({
      link: `${process.env.FRONTEND_URL}/invite?inviteId=${invite.token}`,
      token: invite.token,
      createdBy: invite.creator?.name ?? 'Unknown',
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      oneTimeUse: invite.oneTimeUse
    }))
  };
};

export const deleteOrganizationInvite = async ({
  req,
  params: { idOrPath, token }
}: {
  req: TsRestRequest<typeof contract.organizations.deleteOrganizationInvite>;
  params: TsRestRequest<typeof contract.organizations.deleteOrganizationInvite>['params'];
}) => {
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Method not available for API keys' }
    };
  }

  const organization = await getOrganizationByPath(idOrPath, {
    requester: req.requester
  });

  if (!organization) {
    return {
      status: 404 as const,
      body: { message: 'Organization not found' }
    };
  }

  // Find the invite
  const invite = await db.query.organizationInvites.findFirst({
    where: and(
      eq(Schema.organizationInvites.organizationId, organization.id),
      eq(Schema.organizationInvites.token, token)
    )
  });

  if (!invite) {
    return {
      status: 404 as const,
      body: { message: 'Invite not found' }
    };
  }

  // Check if user is org owner or invite creator
  const isOwner = organization.createdById === req.requester.userId;
  const isCreator = invite.createdBy === req.requester.userId;

  if (!isOwner && !isCreator) {
    return {
      status: 403 as const,
      body: { message: 'Only organization owners or invite creators can delete invites' }
    };
  }

  // Delete the invite
  await db.delete(Schema.organizationInvites)
    .where(and(
      eq(Schema.organizationInvites.organizationId, organization.id),
      eq(Schema.organizationInvites.token, token)
    ));

  return {
    status: 200 as const,
    body: { message: 'Invite deleted successfully' }
  };
};

export const updateAccess = async ({
  req,
  params: { idOrPath },
  body: { userIdOrName, canAddMembers, canCreateEnvironments, canCreateProjects, canEditProject, canEditOrganization }
}: {
  req: TsRestRequest<typeof contract.organizations.updateAccess>;
  params: TsRestRequest<typeof contract.organizations.updateAccess>['params'];
  body: TsRestRequest<typeof contract.organizations.updateAccess>['body'];
}) => {
  try {

    if(!isUserRequester(req.requester)) {
      return {
        status: 403 as const,
        body: { message: 'Cannot edit organization access with API key' }
      };
    }

    // Get organization and verify caller has canAddMembers permission
    const organization = await getOrganizationByPath(idOrPath, {
      requester: req.requester,
      addMembers: true // This ensures caller has canAddMembers permission
    });

    if (!organization) {
      return {
        status: 404 as const,
        body: { message: 'Organization not found or insufficient permissions' }
      };
    }

    // Find the target user
    const targetUser = await getUserByNameOrId(userIdOrName);
    if (!targetUser) {
      return {
        status: 404 as const,
        body: { message: 'User not found' }
      };
    }

    if(targetUser.id === req.requester.userId) {
      return {
        status: 400 as const,
        body: { message: 'You cannot update your own permissions' }
      };
    }

    // Update the role permissions
    const [updatedRole] = await db.update(Schema.organizationRoles)
      .set({
        canAddMembers,
        canCreateEnvironments,
        canCreateProjects,
        canEditProject,
        canEditOrganization,
      })
      .where(and(
        eq(Schema.organizationRoles.organizationId, organization.id),
        eq(Schema.organizationRoles.userId, targetUser.id)
      ))
      .returning();

    if (!updatedRole) {
      return {
        status: 500 as const,
        body: { message: 'User is not a member of organization' }
      };
    }

    return {
      status: 200 as const,
      body: { message: 'Permissions updated successfully' }
    };

  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing organization access rights')) {
      return {
        status: 403 as const,
        body: { message: 'Insufficient permissions to update access' }
      };
    }

    return {
      status: 500 as const,
      body: { message: 'Internal server error' }
    };
  }
};

