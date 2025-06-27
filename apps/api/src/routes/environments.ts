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
    } else {

      // get all environments that user can view
      const environmentAccess = await db.query.environmentAccess.findMany({
        where: eq(Schema.environmentAccess.userId, req.user.id),
        with: {
          environment: true
        }
      });
      environments = environmentAccess.map(e => e.environment);

    }

    if(!environments) {
      return {
        status: 404 as const,
        body: { message: 'Environments not found' }
      };
    }

    const environmentsWithVersions = await Promise.all(environments
      .map(async (e) => {
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

        const wrappedEncryptionKey = await db.query.wrappedUserKeys.findFirst({
          where: and(
            eq(Schema.wrappedUserKeys.environmentId, e.id),
            eq(Schema.wrappedUserKeys.userId, req.user!.id)
          )
        });
        if (!wrappedEncryptionKey) {
          throw new Error('Wrapped encryption key not found');
        }

        return {
          ...e,
          latestVersion: {
            ...latestVersion,
            content: latestVersion.encryptedContent.toString('base64'),
            versionNumber: totalVersions[0]?.count ?? 1,
            wrappedEncryptionKey: wrappedEncryptionKey.encryptedSymmetricKey.toString('base64')
          } satisfies EnvironmentVersion,
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          }
        } satisfies EnvironmentWithLatestVersion;
      })
    )

    return {
      status: 200 as const,
      body: environmentsWithVersions
    };
}

export const createEnvironment = async ({ 
  req, 
  body: { name, project, encryptedContent, invitedUsers }
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

      const [env] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: projectDb.id
        })
        .returning();

      if (!env) return null;

      // Check that provided users belong to the organization
      if (invitedUsers) {
        const invitedUserIds = invitedUsers.map(u => u.userId);

        const organizationUsers = await tx.select()
          .from(Schema.organizationRoles)
          .where(and(
            eq(Schema.organizationRoles.organizationId, organization.id),
            inArray(Schema.organizationRoles.userId, invitedUserIds )
          )
        );
        if (organizationUsers.length !== invitedUserIds.length) {
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

        // Create environment encryption keys for each user
        await tx.insert(Schema.wrappedUserKeys)
          .values(invitedUsers.map(u => ({
            environmentId: env.id,
            userId: u.userId,
            encryptedSymmetricKey: Buffer.from(u.wrappedEd25519Key, 'base64')
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


      const [latestVersion] = await tx.insert(Schema.environmentVersions)
        .values({
          environmentId: env.id,
          encryptedContent: Buffer.from(encryptedContent.ciphertext, 'base64'),
          savedBy: req.user!.id
        }).returning();

      if (!latestVersion) return null;

      // Add entries to environmentVersionKeys for each key
      if (encryptedContent.keys && encryptedContent.keys.length > 0) {
        await tx.insert(Schema.environmentVersionKeys)
          .values(encryptedContent.keys.map(key => ({
            key,
            environmentVersionId: latestVersion.id,
          })));
      }
      const invitedUserIds = invitedUsers?.map(u => u.userId);
      const allowedUsers = invitedUserIds ? await tx.select({
        id: Schema.users.id,
        name: Schema.users.name,
      })
        .from(Schema.users)
        .where(inArray(Schema.users.id, invitedUserIds)) : [];

      const wrappedEncryptionKey = await tx.query.wrappedUserKeys.findFirst({
        where: and(
          eq(Schema.wrappedUserKeys.environmentId, env.id),
          eq(Schema.wrappedUserKeys.userId, req.user!.id)
        )
      });
      if (!wrappedEncryptionKey) {
        throw new Error('Wrapped encryption key not found');
      }

      return {
        ...env,
        latestVersion: {
          ...latestVersion,
          content: encryptedContent.ciphertext,
          versionNumber: 1,
          wrappedEncryptionKey: wrappedEncryptionKey.encryptedSymmetricKey.toString('base64')
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
  body: { encryptedContent }
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

  // Update content in transaction
  const updatedEnvironment = await db.transaction(async (tx) => {
    const [version] = await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: environment.id,
        encryptedContent: Buffer.from(encryptedContent.ciphertext, 'base64'),
        savedBy: req.user!.id
      })
      .returning();

    if (!version) return null;

    // Add entries to environmentVersionKeys for each key
    if (encryptedContent.keys && encryptedContent.keys.length > 0) {
      await tx.insert(Schema.environmentVersionKeys)
        .values(encryptedContent.keys.map(key => ({
          key,
          environmentVersionId: version.id,
        })));
    }

    return version;
  });

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
  body: { preserveVersions }
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

  const wrappedEncryptionKey = await db.query.wrappedUserKeys.findFirst({
    where: and(
      eq(Schema.wrappedUserKeys.environmentId, environment.id),
      eq(Schema.wrappedUserKeys.userId, req.user!.id)
    )
  });

  if (!wrappedEncryptionKey) {
    return {
      status: 404 as const,
      body: { message: 'Wrapped encryption key not found' }
    };
  }

  return {
    status: 200 as const,
    body: {
      id: version.id,
      environmentId: version.environmentId,
      savedBy: version.savedBy,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      content: version.encryptedContent.toString('base64'),
      versionNumber: targetVersion,
      wrappedEncryptionKey: wrappedEncryptionKey?.encryptedSymmetricKey.toString('base64')
    } satisfies EnvironmentVersion
  };
};