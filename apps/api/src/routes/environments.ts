import { db, Schema } from '@repo/db';
import { eq, and, count, exists, not, desc, inArray } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import { webcrypto } from 'node:crypto';
import { cryptAESGCM } from '../crypto/crypto';

export const getEnvironment = async ({ req, params: { id } }:
  { req: TsRestRequest<typeof contract.environments.getEnvironment>; params: { id: string } }) => {
  if (!req.user) {
    return {
      status: 401 as const,
      body: { message: 'Unauthorized' }
    };
  }

  const environment = await db.query.environments.findFirst({
    where: eq(Schema.environments.id, id),
    with: {
      versions: true
    }
  });

  if (!environment || !environment.projectId) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Check environment-specific access first
  const environmentAccessCount = await db.select({ count: count() })
    .from(Schema.environmentAccess)
    .where(eq(Schema.environmentAccess.environmentId, id));

  if (environmentAccessCount[0]?.count && environmentAccessCount[0].count > 0) {
    // There are environment-specific access rules, check if user has access
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
    // Fall back to project-level access
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

  return {
    status: 200 as const,
    body: environment
  };
}

export const getEnvironments = async ({ req, query: { projectId } }:
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
          projectId ? eq(Schema.environments.projectId, projectId) : undefined
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
    
    const allowedEnvironments = [...envAccess.map(e => e.environments), ...projectAccess.map(e => e.environments)];
    const envIds = allowedEnvironments.map(e => e.id);
    
    // Take the first version of the environment
    const environmentVersions = await db.query.environmentVersions.findMany({ 
      where: inArray(Schema.environmentVersions.environmentId, envIds),
      orderBy: desc(Schema.environmentVersions.createdAt),
      limit: 1
    });

    return {
      status: 200 as const,
      body: allowedEnvironments.map(e => ({
        ...e,
        versions: environmentVersions
          .filter(v => v.environmentId === e.id)
          .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(v => ({
            ...v,
            content: v.encryptedContent.toString()
          }))
      }))
    };
}

export const createEnvironment = async ({ 
  req, 
  body: { name, projectId, content, allowedUserIds }
}: { 
  req: TsRestRequest<typeof contract.environments.createEnvironment>; 
  body: { name: string; projectId: string; content: string; allowedUserIds?: string[] } 
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

  // Create environment and first version.
  const environment = await db.transaction(async (tx) => {
    const encryptionKey = await tx.query.projectEncryptionKeys.findFirst({
      where: eq(Schema.projectEncryptionKeys.projectId, projectId)
    });

    if (!encryptionKey) return null;

    // Encrypt content using project key
    const encryptedContent = await cryptAESGCM(encryptionKey.key, content);
    const [env] = await tx.insert(Schema.environments)
      .values({
        name,
        projectId: projectId
      })
      .returning();

    if (!env) return null;

    await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: env.id,
        encryptedContent: encryptedContent
      });

    return env;
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
      encryptedContent
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

export const updateEnvironmentAccess = async ({
  req,
  params: { id },
  body: { userIds }
}: {
  req: TsRestRequest<typeof contract.environments.updateEnvironmentAccess>;
  params: { id: string };
  body: { userIds: string[] }
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

  // Delete existing access entries
  await db.delete(Schema.environmentAccess)
    .where(eq(Schema.environmentAccess.environmentId, id));

  // Add new access entries
  if (userIds.length > 0) {
    await db.insert(Schema.environmentAccess)
      .values(
        userIds.map(userId => ({
          environmentId: id,
          userId
        }))
      );
  }

  return {
    status: 200 as const,
    body: { message: 'Environment access updated successfully' }
  };
};