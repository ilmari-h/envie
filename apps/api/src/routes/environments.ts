import { db, Schema } from '@repo/db';
import { eq, and, count, exists, not } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';

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

export const getEnvironments = async ({ req }: { req: TsRestRequest<typeof contract.environments.getEnvironments> }) => {
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
      .where(eq(Schema.environmentAccess.userId, req.user.id));

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
        ))
      ));

    return {
      status: 200 as const,
      body: [...envAccess.map(e => e.environments), ...projectAccess.map(e => e.environments)]
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

  // Create environment
  const [environment] = await db.insert(Schema.environments)
    .values({
      name,
      projectId: parseInt(projectId),
      encryptedContent: Buffer.from(content)
    })
    .returning();

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
  params: { id: string };
  body: { content: string }
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

  // Update content
  const [updatedEnvironment] = await db.update(Schema.environments)
    .set({
      encryptedContent: Buffer.from(content)
    })
    .where(eq(Schema.environments.id, id))
    .returning();

  if (!updatedEnvironment) {
    return {
      status: 500 as const,
      body: { message: 'Failed to update environment' }
    };
  }

  return {
    status: 200 as const,
    body: updatedEnvironment
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