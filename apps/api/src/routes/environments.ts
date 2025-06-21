import { db, Environment, Schema } from '@repo/db';
import { eq, and, count, exists, not, desc, inArray } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { cryptAESGCM, decryptAESGCM } from '../crypto/crypto';
import type { EnvironmentVersion, EnvironmentWithLatestVersion } from '@repo/rest';
import { getEnvironmentByPath, getProjectByPath, getProjectEnvironments } from '../queries/by-path';

export const getEnvironments = async ({ req, query: { projectIdOrPath, environmentIdOrPath } }:
  {
    req: TsRestRequest<typeof contract.environments.getEnvironments>,
    query: TsRestRequest<typeof contract.environments.getEnvironments>['query']
  }) => {
    if (!req.user) {
      return {
        status: 401 as const,
        body: { message: 'Unauthorized' }
      };
    }

    if(projectIdOrPath && environmentIdOrPath) {
      return {
        status: 400 as const,
        body: { message: 'Cannot specify both project and environment' }
      };
    }

    let environments: Environment[] = [];
    if(projectIdOrPath) {
      console.log("Getting project environments", projectIdOrPath);
      environments = await getProjectEnvironments(projectIdOrPath, {
        userId: req.user.id
      });
    } else if(environmentIdOrPath) {
      const [_o, _p, environment] = await getEnvironmentByPath(environmentIdOrPath, {
        userId: req.user.id
      });
      if(!environment) {
        return {
          status: 404 as const,
          body: { message: 'Environment not found' }
        };
      }
      environments = [environment];
    }

    if(!environments) {
      return {
        status: 404 as const,
        body: { message: 'Environments not found' }
      };
    }

    const environmentsWithVersionsDecrypted = await Promise.all(environments
      .map(async (e) => {
        const encryptionKey = await db.query.projectEncryptionKeys.findFirst({
          where: eq(Schema.projectEncryptionKeys.projectId, e.projectId)
        });
        if (!encryptionKey) throw new Error(`Encryption key not found for project ${e.projectId}`);
        const latestVersion = await db.query.environmentVersions.findFirst({
          where: eq(Schema.environmentVersions.environmentId, e.id),
          orderBy: desc(Schema.environmentVersions.createdAt),
        });
        const totalVersions = await db.select({ count: count() })
          .from(Schema.environmentVersions)
          .where(eq(Schema.environmentVersions.environmentId, e.id));

        const accessControl = await db.select()
          .from(Schema.environmentAccess)
          .innerJoin(Schema.users, eq(Schema.environmentAccess.userId, Schema.users.id))
          .where(eq(Schema.environmentAccess.environmentId, e.id));
        if (!latestVersion) return {
          ...e,
          latestVersion: null,
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          }
        } satisfies EnvironmentWithLatestVersion;
        const content = await decryptAESGCM(encryptionKey.key, latestVersion.encryptedContent);
        return {
          ...e,
          latestVersion: {
            ...latestVersion,
            content,
            versionNumber: totalVersions[0]?.count ?? 1
          } satisfies EnvironmentVersion,
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          }
        } satisfies EnvironmentWithLatestVersion;
      })
    )

    return {
      status: 200 as const,
      body: environmentsWithVersionsDecrypted
    };
}

export const createEnvironment = async ({ 
  req, 
  body: { name, project, content, allowedUserIds }
}: { 
  req: TsRestRequest<typeof contract.environments.createEnvironment>; 
  body: TsRestRequest<typeof contract.environments.createEnvironment>['body']
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization, projectDb] = await getProjectByPath(project, {
    userId: req.user.id,
    createEnvironments: true
  });
  if(!organization || !projectDb) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  // Create environment and first version if content is provided.
  const environment = await db.transaction(async (tx) => {
    const encryptionKey = await tx.query.projectEncryptionKeys.findFirst({
      where: eq(Schema.projectEncryptionKeys.projectId, projectDb.id)
    });

    if (!encryptionKey) return null;

      const [env] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: projectDb.id
        })
        .returning();

      if (!env) return null;

      // Check that provided user ids belong to the organization
      if (allowedUserIds) {
        const organizationUsers = await tx.select()
          .from(Schema.organizationRoles)
          .where(and(
            eq(Schema.organizationRoles.organizationId, organization.id),
            inArray(Schema.organizationRoles.userId, allowedUserIds )
          )
        );
        if (organizationUsers.length !== allowedUserIds.length) {
          throw new Error('One or more user ids do not belong to the organization');
        }

        // Create environment access for each user
        await tx.insert(Schema.environmentAccess)
          .values(organizationUsers.map(r => ({
            environmentId: env.id,
            userId: r.userId!,
            organizationRoleId: r.id,
            expiresAt: null
          })));
      }

      // Create environment access for the creator
      await tx.insert(Schema.environmentAccess)
        .values({
          environmentId: env.id,
          userId: req.user!.id,
          organizationRoleId: organization.role.id,
          expiresAt: null
        });


      // Encrypt content using project key
      const encryptedContent = await cryptAESGCM(encryptionKey.key, content ?? "");

      const [latestVersion] = await tx.insert(Schema.environmentVersions)
        .values({
          environmentId: env.id,
          encryptedContent: encryptedContent,
          savedBy: req.user!.id
        }).returning();

      if (!latestVersion) return null;
      const allowedUsers = await tx.select()
        .from(Schema.users)
        .where(inArray(Schema.users.id, allowedUserIds ?? []));

      return {
        ...env,
        latestVersion: {
          ...latestVersion,
          content: content ?? "",
          versionNumber: 1,
        } satisfies EnvironmentVersion,
        accessControl: {
          users: allowedUsers
        }
      } satisfies EnvironmentWithLatestVersion;
  });

  if (!environment) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create environment' }
    };
  }

  return {
    status: 201 as const,
    body: environment
  };
};

export const updateEnvironmentContent = async ({
  req,
  params: { idOrPath },
  body: { content }
}: {
  req: TsRestRequest<typeof contract.environments.updateEnvironmentContent>;
  params: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['params'];
  body: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['body']
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    userId: req.user.id,
    editEnvironment: true
  });
  if(!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  const encryptionKey = await db.query.projectEncryptionKeys.findFirst({
    where: eq(Schema.projectEncryptionKeys.projectId, project.id)
  });

  if (!encryptionKey) {
    return {
      status: 500 as const,
      body: { message: 'Failed to update environment' }
    };
  }

  const encryptedContent = await cryptAESGCM(encryptionKey.key, content);

  // Update content
  const [updatedEnvironment] = await db.insert(Schema.environmentVersions)
    .values({
      environmentId: environment.id,
      encryptedContent,
      savedBy: req.user.id
    })
    .returning();

  if (!updatedEnvironment) {
    return {
      status: 500 as const,
      body: { message: 'Failed to update environment' }
    };
  }

  return {
    status: 200 as const,
    body: {}
  };
};

export const updateEnvironmentSettings = async ({
  req,
  params: { idOrPath },
  body: { allowedUserIds, preserveVersions }
}: {
  req: TsRestRequest<typeof contract.environments.updateEnvironmentSettings>;
  params: TsRestRequest<typeof contract.environments.updateEnvironmentSettings>['params'];
  body: TsRestRequest<typeof contract.environments.updateEnvironmentSettings>['body']
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    userId: req.user.id,
    editEnvironment: true
  });
  if(!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Delete existing access entries and add new ones
  if (allowedUserIds) {
    await db.transaction(async (tx) => {
      await tx.delete(Schema.environmentAccess)
        .where(eq(Schema.environmentAccess.environmentId, environment.id));
      if (allowedUserIds.length > 0) {

        const organizationUsers = await tx.select()
          .from(Schema.organizationRoles)
          .where(and(
            eq(Schema.organizationRoles.organizationId, organization.id),
            inArray(Schema.organizationRoles.userId, allowedUserIds )
          )
        );
        if (organizationUsers.length !== allowedUserIds.length) {
          throw new Error('One or more user ids do not belong to the organization');
        }

        await tx.insert(Schema.environmentAccess)
          .values(
            organizationUsers.map(r => ({
              environmentId: environment.id,
              userId: r.userId!,
              organizationRoleId: r.id,
              expiresAt: null
            }))
          );
      }
    });
  }

  // Update environment settings
  if (preserveVersions !== undefined) {
    await db.update(Schema.environments)
      .set({
        preservedVersions: preserveVersions
      })
      .where(eq(Schema.environments.id, environment.id));
  }

  return {
    status: 200 as const,
    body: { message: 'Environment access updated successfully' }
  };
};

export const getEnvironmentVersion = async ({
  req,
  params: { idOrPath, versionNumber }
}: {
  req: TsRestRequest<typeof contract.environments.getEnvironmentVersion>;
  params: TsRestRequest<typeof contract.environments.getEnvironmentVersion>['params'];
}) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    userId: req.user.id
  });
  if(!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get total version count
  const totalVersions = await db.select({ count: count() })
    .from(Schema.environmentVersions)
    .where(eq(Schema.environmentVersions.environmentId, environment.id));

  const versionCount = totalVersions[0]?.count ?? 0;
  const targetVersion = versionNumber !== undefined ? parseInt(versionNumber, 10) : versionCount;

  // Get the specific version
  const version = await db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, environment.id),
    orderBy: desc(Schema.environmentVersions.createdAt),
    offset: versionCount - targetVersion,
  });

  if (!version) {
    return {
      status: 404 as const,
      body: { message: 'Version not found' }
    };
  }

  // Get encryption key and decrypt content
  const encryptionKey = await db.query.projectEncryptionKeys.findFirst({
    where: eq(Schema.projectEncryptionKeys.projectId, environment.projectId)
  });

  if (!encryptionKey) {
    return {
      status: 500 as const,
      body: { message: 'Failed to decrypt environment content' }
    };
  }

  const content = await decryptAESGCM(encryptionKey.key, version.encryptedContent);

  return {
    status: 200 as const,
    body: {
      id: version.id,
      environmentId: version.environmentId,
      savedBy: version.savedBy,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      content,
      versionNumber: targetVersion
    } satisfies EnvironmentVersion
  };
};