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
        userId: req.user!.id,
        role: 'admin'
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

export const updateProject = async ({
  req,
  params: { id },
  body: { name, description }
}: {
  req: TsRestRequest<typeof contract.projects.updateProject>;
  params: TsRestRequest<typeof contract.projects.updateProject>['params'];
  body: TsRestRequest<typeof contract.projects.updateProject>['body'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Check if user has access to project
  const hasAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Access denied' }
    };
  }

  const [project] = await db.update(Schema.projects)
    .set({
      name,
      description,
      updatedAt: new Date()
    })
    .where(eq(Schema.projects.id, id))
    .returning();

  if (!project) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  return {
    status: 200 as const,
    body: project
  };
};

export const generateInviteLink = async ({
  req,
  params: { id },
  body: { oneTimeUse, expiresAt }
}: {
  req: TsRestRequest<typeof contract.projects.generateInviteLink>;
  params: TsRestRequest<typeof contract.projects.generateInviteLink>['params'];
  body: TsRestRequest<typeof contract.projects.generateInviteLink>['body'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Check if user has access to project
  const hasAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Access denied' }
    };
  }

  // Generate a unique token
  const token = webcrypto.randomUUID();

  // Store the invite link in the database
  await db.insert(Schema.projectInvites)
    .values({
      projectId: id,
      token,
      oneTimeUse,
      expiresAt,
      createdBy: req.user.id
    });

  return {
    status: 200 as const,
    body: {
      link: `${process.env.FRONTEND_URL}/invite?inviteId=${token}`
    }
  };
};

export const removeInviteLinks = async ({
  req,
  params: { id }
}: {
  req: TsRestRequest<typeof contract.projects.removeInviteLinks>;
  params: TsRestRequest<typeof contract.projects.removeInviteLinks>['params'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Check if user has access to project
  const hasAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Access denied' }
    };
  }

  // Delete all invite links for this project
  await db.delete(Schema.projectInvites)
    .where(eq(Schema.projectInvites.projectId, id));

  return {
    status: 200 as const,
    body: { message: 'All invite links removed' }
  };
};

export const removeUser = async ({
  req,
  params: { id, userId }
}: {
  req: TsRestRequest<typeof contract.projects.removeUser>;
  params: TsRestRequest<typeof contract.projects.removeUser>['params'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Check if user has access to project
  const hasAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Access denied' }
    };
  }

  // Cannot remove yourself
  if (userId === req.user.id) {
    return {
      status: 403 as const,
      body: { message: 'Cannot remove yourself from the project' }
    };
  }

  // Remove user from project access
  const result = await db.delete(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, userId)
    ))
    .returning();

  if (result.length === 0) {
    return {
      status: 404 as const,
      body: { message: 'User not found in project' }
    };
  }

  return {
    status: 200 as const,
    body: { message: 'User removed from project' }
  };
};

export const deleteProject = async ({
  req,
  params: { id }
}: {
  req: TsRestRequest<typeof contract.projects.deleteProject>;
  params: TsRestRequest<typeof contract.projects.deleteProject>['params'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  // Check if user has admin access to project
  const access = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, id),
      eq(Schema.projectAccess.userId, req.user.id),
      eq(Schema.projectAccess.role, 'admin')
    ))
    .limit(1);

  if (access.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Only project admins can delete projects' }
    };
  }

  // Delete project (cascade will handle related records)
  const result = await db.delete(Schema.projects)
    .where(eq(Schema.projects.id, id))
    .returning();

  if (result.length === 0) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  return {
    status: 200 as const,
    body: { message: 'Project deleted successfully' }
  };
};

export const getProjectByInvite = async ({
  params: { inviteId }
}: {
  params: TsRestRequest<typeof contract.projects.getProjectByInvite>['params']
}) => {
  console.log("Invite ID", inviteId);
  const invite = await db.query.projectInvites.findFirst({
    where: eq(Schema.projectInvites.token, inviteId),
    with: {
      project: true
    }
  });

  if (!invite || !invite.project) {
    return {
      status: 404 as const,
      body: { message: 'Invite not found or expired' }
    };
  }

  // Check if invite is expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return {
      status: 404 as const,
      body: { message: 'Invite link has expired' }
    };
  }

  return {
    status: 200 as const,
    body: {
      project: invite.project,
      invite: {
        oneTimeUse: invite.oneTimeUse,
        expiresAt: invite.expiresAt
      }
    }
  };
};
