import { db, Environment, EnvironmentAccess, Schema } from '@repo/db';
import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import type { EnvironmentVersion, EnvironmentVersionWithWrappedEncryptionKey, EnvironmentWithVersion } from '@repo/rest';
import { getEnvironmentByPath, getOrganizationEnvironments, getProjectByPath, getProjectEnvironments } from '../queries/by-path';
import { isUserRequester } from '../types/cast';
import { getEnvironmentVersionByIndex } from '../queries/environment-version';

export const getEnvironments = async ({ req, query: { path, version } }:
  {
    req: TsRestRequest<typeof contract.environments.getEnvironments>,
    query: TsRestRequest<typeof contract.environments.getEnvironments>['query']
  }) => {

    const pathParts = path?.split(':') ?? [];
    if(pathParts.length !== 3 && version) {
      return {
        status: 400 as const,
        body: { message: 'Version number only allowed for single environment' }
      };
    }

    let environments: (Environment & { access: EnvironmentAccess })[] = [];
    if(pathParts.length === 1) {
      const orgEnvironments = await getOrganizationEnvironments(pathParts[0]!, {
        requester: req.requester
      });
      environments = orgEnvironments;
    } else if(pathParts.length === 2) {
      environments = await getProjectEnvironments(pathParts[0]! + ':' + pathParts[1]!, {
        requester: req.requester
      });
    } else if(pathParts.length === 3) {
      const [_organization, _project, environment] = await getEnvironmentByPath(
        pathParts[0]! + ':' + pathParts[1]! + ':' + pathParts[2]!, { requester: req.requester }
      );
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
        where: isUserRequester(req.requester)
          ? eq(Schema.environmentAccess.userId, req.requester.userId)
          : eq(Schema.environmentAccess.accessTokenId, req.requester.apiKeyId),
        with: {
          environment: {
            with: {
              project: {
                with: {
                  organization: true
                }
              }
            }
          }
        }
      });
      environments = environmentAccess.map(e => ({
        ...e.environment,
        access: e
      }));
    }

    if(!environments) {
      return {
        status: 404 as const,
        body: { message: 'Environments not found' }
      };
    }

    const environmentsWithVersions = await Promise.all(environments
      .map(async (e) => {
        const environmentVersion = await getEnvironmentVersionByIndex(e.id, version);
        const totalVersions = await db.select({ count: count() })
          .from(Schema.environmentVersions)
          .where(eq(Schema.environmentVersions.environmentId, e.id));

        const accessControl = await db.select()
          .from(Schema.environmentAccess)
          .innerJoin(Schema.users, eq(Schema.environmentAccess.userId, Schema.users.id))
          .where(eq(Schema.environmentAccess.environmentId, e.id));

        if (!environmentVersion) return {
          ...e,
          version: null,
          decryptionData: {
            wrappedEncryptionKey: e.access.encryptedSymmetricKey.toString('base64'),
            ephemeralPublicKey: e.access.ephemeralPublicKey.toString('base64')
          },
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          }
        } satisfies EnvironmentWithVersion;
        return {
          ...e,
          version: {
            ...environmentVersion,
            content: environmentVersion.encryptedContent.toString('base64'),
            keys: environmentVersion.keys.map(k => k.key),
            versionNumber: totalVersions[0]?.count ?? 1,
          } satisfies EnvironmentVersion,
          decryptionData: {
            wrappedEncryptionKey: e.access.encryptedSymmetricKey.toString('base64'),
            ephemeralPublicKey: e.access.ephemeralPublicKey.toString('base64')
          },
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          }
        } satisfies EnvironmentWithVersion;
      })
    )

    return {
      status: 200 as const,
      body: environmentsWithVersions
    };
}

// Creates a new environment with the given name and project
// Optionally adds given users to the environment with the environment AES key wrapped with each user's public key
export const createEnvironment = async ({ 
  req, 
  body: { name, project, encryptedContent, invitedUsers, userWrappedAesKey, userEphemeralPublicKey }
}: { 
  req: TsRestRequest<typeof contract.environments.createEnvironment>; 
  body: TsRestRequest<typeof contract.environments.createEnvironment>['body']
}) => {

  const [organization, projectDb] = await getProjectByPath(project, {
    requester: req.requester,
    createEnvironments: true
  });
  if(!organization || !projectDb) {
    return {
      status: 404 as const,
      body: { message: 'Project not found' }
    };
  }

  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Environment creation only via CLI' }
    };
  }
  const requester = req.requester

  // Check if environment already exists
  const existingEnvironment = await db.query.environments.findFirst({
    where: and(
      eq(Schema.environments.name, name),
      eq(Schema.environments.projectId, projectDb.id)
    )
  });

  if (existingEnvironment) {
    return {
      status: 400 as const,
      body: { message: 'environment already exists' }
    };
  }

  // Create environment and first version if content is provided.
  const environment = await db.transaction(async (tx) => {

      const [newEnvironment] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: projectDb.id
        })
        .returning();

      if (!newEnvironment) return null;

      // If users were invited, we create an environment access entry for each of them with the AES key for the
      // environment wrapped with their public key
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
          .values(organizationUsers.map(r => {
            const user = invitedUsers.find(u => u.userId === r.userId);
            if (!user) {
              throw new Error('User not found in invited users');
            }
            return {
            environmentId: newEnvironment.id,
            userId: r.userId!,
            organizationRoleId: r.id,
            encryptedSymmetricKey: Buffer.from(user.wrappedAesKey, 'base64'),
            ephemeralPublicKey: Buffer.from(user.ephemeralPublicKey, 'base64'),
            expiresAt: null
          }}));
      }

      // Create environment access for the creator with the AES key for the environment wrapped with their public key
      await tx.insert(Schema.environmentAccess)
        .values({
          environmentId: newEnvironment.id,
          userId: requester.userId,
          organizationRoleId: organization.role.id,
          encryptedSymmetricKey: Buffer.from(userWrappedAesKey, 'base64'),
          ephemeralPublicKey: Buffer.from(userEphemeralPublicKey, 'base64'),
          write: true,
          expiresAt: null
        });

      // Create the first version of the environment with entries for each key
      const [firstVersion] = await tx.insert(Schema.environmentVersions)
        .values({
          environmentId: newEnvironment.id,
          encryptedContent: Buffer.from(encryptedContent.ciphertext, 'base64'),
          savedBy: requester.userId
        }).returning();

      if (!firstVersion) return null;
      if (encryptedContent.keys && encryptedContent.keys.length > 0) {
        await tx.insert(Schema.environmentVersionKeys)
          .values(encryptedContent.keys.map(key => ({
            key,
            environmentVersionId: firstVersion.id,
          })));
      }

      return newEnvironment;
  });

  if (!environment) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create environment' }
    };
  }

  return {
    status: 201 as const,
    body: { message: 'Environment created successfully' }
  };
};

// Creates a new version for the given environment
export const updateEnvironmentContent = async ({
  req,
  params: { idOrPath },
  body: { encryptedContent }
}: {
  req: TsRestRequest<typeof contract.environments.updateEnvironmentContent>;
  params: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['params'];
  body: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['body']
}) => {
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Environment update only via CLI' }
    };
  }

  const requester = req.requester
  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
    editEnvironment: true
  });
  if(!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Update content in transaction
  const updatedVersion = await db.transaction(async (tx) => {
    const [updatedVersion] = await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: environment.id,
        encryptedContent: Buffer.from(encryptedContent.ciphertext, 'base64'),
        savedBy: requester.userId
      })
      .returning();

    if (!updatedVersion) return null;

    // Add entries to environmentVersionKeys for each key
    if (encryptedContent.keys && encryptedContent.keys.length > 0) {
      await tx.insert(Schema.environmentVersionKeys)
        .values(encryptedContent.keys.map(key => ({
          key,
          environmentVersionId: updatedVersion.id,
        })));
    }

    return updatedVersion;
  });

  if (!updatedVersion) {
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

  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
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