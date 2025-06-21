import { db, Organization, Schema } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { webcrypto } from 'node:crypto';
import { getProjectByPath, getOrganization } from '../queries/by-path';

export const getProject = async ({ req, params: { idOrPath } }:
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

  const [ organization, project ] = await getProjectByPath(idOrPath, {
    userId: req.user.id
  });
  if(!organization || !project) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  return {
    status: 200 as const,
    body: {
      ...project,
      organization: organization
    }
  };
}

export const getProjects = async ({ req, query }:
  {
    req: TsRestRequest<typeof contract.projects.getProjects>,
    query: TsRestRequest<typeof contract.projects.getProjects>['query']
  }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  let organizationsUserBelongsTo: Organization[] = [];
  if(query.organization) {
    const organization = await getOrganization(query.organization, {
      userId: req.user.id
    });
    if (!organization) {
      return {
        status: 404 as const,
        body: { message: 'Organization not found' }
      };
    }
    organizationsUserBelongsTo.push(organization);
  } else {
    // Get all organizations user belongs to
    const organizationRoles = await db.query.organizationRoles.findMany({
      where: eq(Schema.organizationRoles.userId, req.user.id),
      with: {
        organization: true
      }
    });
    organizationsUserBelongsTo = organizationRoles.map(r => r.organization);
  }
  // Return all projects regardless if user has access to them

  const projects = await db.query.projects.findMany({
    where: inArray(Schema.projects.organizationId, organizationsUserBelongsTo.map(o => o.id)),
    with: {
      organization: true
    }
  });

  return {
    status: 200 as const,
    body: projects.map(p => ({
      ...p,
      organization: p.organization
    }))
  };
}

export const createProject = async ({ 
  req, 
  body: { name, description, organizationIdOrName, defaultEnvironments } 
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

  const organization = await getOrganization(organizationIdOrName, {
    userId: req.user.id,
    createProjects: true
  });
  if (!organization) {
    return {
      status: 400 as const,
      body: { message: 'Invalid organization' }
    };
  }

  // Create project
  const project = await db.transaction(async (tx) => {
    const [project] = await tx.insert(Schema.projects)
    .values({
      name,
      description,
      organizationId: organization.id
    })
    .returning();
    if(!project) {
      return null
    }

    // Generate and store encryption key
    const randomBytes = webcrypto.getRandomValues(new Uint8Array(32));
    const key = Buffer.from(randomBytes);
    await tx.insert(Schema.projectEncryptionKeys)
      .values({
        projectId: project.id,
        key
      });

    // Add default environments
    if (defaultEnvironments && defaultEnvironments.length > 0) {
      const environments = await tx.insert(Schema.environments).values(defaultEnvironments.map(env => ({
        projectId: project.id,
        name: env
      }))).returning();

      // Add creator to environment access
      await tx.insert(Schema.environmentAccess)
        .values(environments.map(e => ({
          environmentId: e.id,
          userId: req.user!.id,
          organizationRoleId: organization.role.id,
          expiresAt: null
        })));
      }

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
  params: { idOrPath },
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

  const [organization, project] = await getProjectByPath(idOrPath, {
    userId: req.user.id,
    editProject: true
  });
  if (!organization || !project) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  const [updatedProject] = await db.update(Schema.projects)
    .set({
      name,
      description,
    })
    .where(eq(Schema.projects.id, project.id))
    .returning();

  if (!updatedProject) {
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

export const deleteProject = async ({
  req,
  params: { idOrPath }
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

  const [organization, project] = await getProjectByPath(idOrPath, {
    userId: req.user.id,
    editProject: true
  });
  if (!organization || !project) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  // Delete project (cascade will handle related records)
  const result = await db.delete(Schema.projects)
    .where(eq(Schema.projects.id, project.id))
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

// export const getProjectByInvite = async ({
//   params: { inviteId }
// }: {
//   params: TsRestRequest<typeof contract.projects.getProjectByInvite>['params']
// }) => {
//   console.log("Invite ID", inviteId);
//   const invite = await db.query.projectInvites.findFirst({
//     where: eq(Schema.projectInvites.token, inviteId),
//     with: {
//       project: true
//     }
//   });

//   if (!invite || !invite.project) {
//     return {
//       status: 404 as const,
//       body: { message: 'Invite not found or expired' }
//     };
//   }

//   // Check if invite is expired
//   if (invite.expiresAt && invite.expiresAt < new Date()) {
//     return {
//       status: 404 as const,
//       body: { message: 'Invite link has expired' }
//     };
//   }

//   return {
//     status: 200 as const,
//     body: {
//       project: invite.project,
//       invite: {
//         oneTimeUse: invite.oneTimeUse,
//         expiresAt: invite.expiresAt
//       }
//     }
//   };
// };

// export const acceptInvite = async ({
//   req,
//   params: { inviteId }
// }: {
//   req: TsRestRequest<typeof contract.projects.acceptInviteLink>,
//   params: TsRestRequest<typeof contract.projects.acceptInviteLink>['params']
// }) => {

//   if (req.user && req.user.id) {
//     // User already logged in, so just add to project
//     return db.transaction(async (tx) => {
//       const inviteInDb = await tx.query.projectInvites.findFirst({
//         where: and(
//           eq(Schema.projectInvites.token, inviteId),
//         )
//       });

//       if (!inviteInDb || inviteInDb.expiresAt < new Date()) {  
//         return {
//           status: 404 as const,
//           body: { message: 'Invite not found or expired' }
//         };
//       }

//       await tx.insert(Schema.projectAccess)
//         .values({
//           projectId: inviteInDb.projectId,
//           userId: req.user!.id,
//         }).onConflictDoNothing({
//           target: [Schema.projectAccess.userId, Schema.projectAccess.projectId]
//         });
      
//       if (inviteInDb.oneTimeUse) {
//         await tx.delete(Schema.projectInvites)
//           .where(eq(Schema.projectInvites.token, inviteId));
//       }

//       return {
//         status: 302 as const,
//         headers: {
//           Location: `${process.env.FRONTEND_URL}/projects/${inviteInDb.projectId}`
//         },
//         body: { message: 'Redirecting to project' }
//       };
//     })
//   }
//   return {
//     status: 302 as const,
//     headers: {
//       Location: `${process.env.FRONTEND_URL}?inviteId=${inviteId}`
//     },
//     body: { message: 'Redirecting to login' }
//   };
// }