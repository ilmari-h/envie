import { db, Schema } from '@repo/db';
import { eq, and, count, exists, not, desc, inArray } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { cryptAESGCM, decryptAESGCM } from '../crypto/crypto';
import type { EnvironmentVersion, EnvironmentWithLatestVersion } from '@repo/rest';

export const getEnvironments = async ({ req, query: { projectId, environmentId } }:
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
    // Get all environment-specific access entries for this user
    const envAccess = await db.select({environments: Schema.environments})
      .from(Schema.environmentAccess)
      .innerJoin(Schema.environments, eq(Schema.environmentAccess.environmentId, Schema.environments.id))
      .where(
        and(
          eq(Schema.environmentAccess.userId, req.user.id),
          projectId ? eq(Schema.environments.projectId, projectId) : undefined,
        )
      ).orderBy(desc(Schema.environments.name));

    // Get all project access entries for this user, excluding environments with direct access
    const projectAccess = await db.select({environments: Schema.environments})
      .from(Schema.projectAccess)
      .innerJoin(Schema.projects, eq(Schema.projectAccess.projectId, Schema.projects.id))
      .innerJoin(Schema.environments, eq(Schema.projects.id, Schema.environments.projectId))
      .where(and(
        eq(Schema.projectAccess.userId, req.user.id),
        not(exists(
          db.select()
            .from(Schema.environmentAccess)
            .where(eq(Schema.environmentAccess.environmentId, Schema.environments.id))
        )),
        projectId ? eq(Schema.projects.id, projectId) : undefined
      )).orderBy(desc(Schema.environments.name));
    
    const allowedEnvironments = [...envAccess.map(e => e.environments), ...projectAccess.map(e => e.environments)]
      .filter(e => environmentId ? e.id === environmentId : true);
    const environmentsWithVersionsDecrypted = await Promise.all(allowedEnvironments
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
            projectWide: accessControl.length === 0,
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
            projectWide: accessControl.length === 0,
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
  body: { name, projectId, content, allowedUserIds }
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

  // Check if user has access to project
  const hasProjectAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, projectId),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasProjectAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Access denied to project' }
    };
  }

  // Create environment and first version if content is provided.
  const environment = await db.transaction(async (tx) => {
    const encryptionKey = await tx.query.projectEncryptionKeys.findFirst({
      where: eq(Schema.projectEncryptionKeys.projectId, projectId)
    });

    if (!encryptionKey) return null;

      const [env] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: projectId
        })
        .returning();

      if (!env) return null;

      // Create an environment access with just the creator or if user id's provided, use those.
      // Also check that all user ids belong to the project.
      const userIds = allowedUserIds ?? [req.user!.id];
      const projectUsers = await tx.select()
        .from(Schema.projectAccess)
        .where(and(
          eq(Schema.projectAccess.projectId, projectId),
          inArray(Schema.projectAccess.userId, userIds)
        ));
      if (projectUsers.length !== userIds.length) {
        return null;
      }
      await tx.insert(Schema.environmentAccess)
        .values(userIds.map(userId => ({
          environmentId: env.id,
          userId
        })));

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
        .where(inArray(Schema.users.id, userIds));

      return {
        ...env,
        latestVersion: {
          ...latestVersion,
          content: content ?? "",
          versionNumber: 1,
        } satisfies EnvironmentVersion,
        accessControl: {
          projectWide: allowedUserIds ? false : true,
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

  // If allowedUserIds provided, create environment-specific access
  if (allowedUserIds?.length) {
    await db.insert(Schema.environmentAccess)
      .values(
        allowedUserIds.map(userId => ({
          environmentId: environment.id,
          userId
        }))
      );
  }

  return {
    status: 201 as const,
    body: environment
  };
};

export const updateEnvironmentContent = async ({
  req,
  params: { id },
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

  const environment = await db.query.environments.findFirst({
    where: eq(Schema.environments.id, id),
  });

  if (!environment || !environment.projectId) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Check access using existing logic from getEnvironment
  const environmentAccessCount = await db.select({ count: count() })
    .from(Schema.environmentAccess)
    .where(eq(Schema.environmentAccess.environmentId, id));

  if (environmentAccessCount[0]?.count && environmentAccessCount[0].count > 0) {
    const hasEnvAccess = await db.select()
      .from(Schema.environmentAccess)
      .where(and(
        eq(Schema.environmentAccess.environmentId, id),
        eq(Schema.environmentAccess.userId, req.user.id)
      ))
      .limit(1);

    if (hasEnvAccess.length === 0) {
      return {
        status: 403 as const,
        body: { message: 'Access denied' }
      };
    }
  } else {
    const hasProjectAccess = await db.select()
      .from(Schema.projectAccess)
      .where(and(
        eq(Schema.projectAccess.projectId, environment.projectId.toString()),
        eq(Schema.projectAccess.userId, req.user.id)
      ))
      .limit(1);

    if (hasProjectAccess.length === 0) {
      return {
        status: 403 as const,
        body: { message: 'Access denied' }
      };
    }
  }

  const encryptionKey = await db.query.projectEncryptionKeys.findFirst({
    where: eq(Schema.projectEncryptionKeys.projectId, environment.projectId)
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
      environmentId: id,
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
  params: { id },
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

  const environment = await db.query.environments.findFirst({
    where: eq(Schema.environments.id, id),
  });

  if (!environment || !environment.projectId) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Only allow project access holders to modify environment access
  const hasProjectAccess = await db.select()
    .from(Schema.projectAccess)
    .where(and(
      eq(Schema.projectAccess.projectId, environment.projectId.toString()),
      eq(Schema.projectAccess.userId, req.user.id)
    ))
    .limit(1);

  if (hasProjectAccess.length === 0) {
    return {
      status: 403 as const,
      body: { message: 'Only project members can modify environment access' }
    };
  }

  // Delete existing access entries and add new ones
  // TODO: check that user IDs belong to the project 
  if (allowedUserIds) {
    await db.transaction(async (tx) => {
      await tx.delete(Schema.environmentAccess)
        .where(eq(Schema.environmentAccess.environmentId, id));
      if (allowedUserIds.length > 0) {
        await tx.insert(Schema.environmentAccess)
          .values(
            allowedUserIds.map(userId => ({
              environmentId: id,
              userId
            }))
          );
      }
    });
  }

  // Update preserve versions
  if (preserveVersions !== undefined) {
    await db.update(Schema.environments)
      .set({
        preservedVersions: preserveVersions
      })
      .where(eq(Schema.environments.id, id));
  }

  return {
    status: 200 as const,
    body: { message: 'Environment access updated successfully' }
  };
};

export const getEnvironmentVersion = async ({
  req,
  params: { id, versionNumber }
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

  const environment = await db.query.environments.findFirst({
    where: eq(Schema.environments.id, id),
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Check access using existing logic
  const environmentAccessCount = await db.select({ count: count() })
    .from(Schema.environmentAccess)
    .where(eq(Schema.environmentAccess.environmentId, id));

  if (environmentAccessCount[0]?.count && environmentAccessCount[0].count > 0) {
    const hasEnvAccess = await db.select()
      .from(Schema.environmentAccess)
      .where(and(
        eq(Schema.environmentAccess.environmentId, id),
        eq(Schema.environmentAccess.userId, req.user.id)
      ))
      .limit(1);

    if (hasEnvAccess.length === 0) {
      return {
        status: 403 as const,
        body: { message: 'Access denied' }
      };
    }
  } else {
    const hasProjectAccess = await db.select()
      .from(Schema.projectAccess)
      .where(and(
        eq(Schema.projectAccess.projectId, environment.projectId),
        eq(Schema.projectAccess.userId, req.user.id)
      ))
      .limit(1);

    if (hasProjectAccess.length === 0) {
      return {
        status: 403 as const,
        body: { message: 'Access denied' }
      };
    }
  }

  // Get total version count
  const totalVersions = await db.select({ count: count() })
    .from(Schema.environmentVersions)
    .where(eq(Schema.environmentVersions.environmentId, id));

  const versionCount = totalVersions[0]?.count ?? 0;
  const targetVersion = versionNumber !== undefined ? parseInt(versionNumber, 10) : versionCount;

  // Get the specific version
  const version = await db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, id),
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