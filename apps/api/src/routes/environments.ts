import { db, Environment, EnvironmentAccess, EnvironmentDecryptionData, Schema, AccessToken } from '@repo/db';
import { eq, and, count, desc, max, isNull } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import type { EnvironmentVersion, EnvironmentWithVersion } from '@repo/rest';
import { getEnvironmentById, getEnvironmentByPath, getOrganization, getOrganizationEnvironments, getProjectByPath, getProjectEnvironments } from '../queries/by-path';
import { isUserRequester } from '../types/cast';
import { getEnvironmentVersionByIndex } from '../queries/environment-version';
import { getUserByNameOrId } from '../queries/user';
import { ed25519 } from '@noble/curves/ed25519';
import { getRequesterPublicKey } from '../queries/public-key';
import { late } from 'zod';

// Helper function to verify Ed25519 signatures
function verifySignature(message: string, signature: { signature: string; algorithm: 'ecdsa' | 'rsa' }, publicKey: Buffer): { valid: boolean; error?: string } {
  // Check algorithm support
  if (signature.algorithm !== 'ecdsa') {
    return { valid: false, error: 'Only ECDSA algorithm is supported' };
  }

  try {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = Buffer.from(signature.signature, 'base64');
    
    // The public key from the database might be in SSH format, we need the raw 32-byte key
    let ed25519PublicKey: Uint8Array;
    
    if (publicKey.length === 32) {
      // Raw 32-byte Ed25519 public key
      ed25519PublicKey = new Uint8Array(publicKey);
    } else if (publicKey.length > 32) {
      // Likely SSH format, extract the raw key (skip the SSH header)
      // For ssh-ed25519, the format is: 4-byte length + "ssh-ed25519" + 4-byte length + 32-byte key
      const keyTypeLen = publicKey.readUInt32BE(0);
      const keyStart = 4 + keyTypeLen + 4; // Skip type length + type + key length
      ed25519PublicKey = new Uint8Array(publicKey.slice(keyStart, keyStart + 32));
    } else {
      return { valid: false, error: 'Invalid public key format' };
    }

    const isValid = ed25519.verify(signatureBytes, messageBytes, ed25519PublicKey);
    return { valid: isValid };
  } catch (error) {
    return { valid: false, error: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export const getEnvironments = async ({ req, query: { path, environmentId, version, pubkey, variableGroups } }:
  {
    req: TsRestRequest<typeof contract.environments.getEnvironments>,
    query: TsRestRequest<typeof contract.environments.getEnvironments>['query']
  }) => {

    let environments: (Environment & { access: EnvironmentAccess & { decryptionData: EnvironmentDecryptionData[] } })[] = [];
    if(path || !environmentId) {
      const pathParts = path?.split(':') ?? [];
      if(pathParts.length !== 3 && version) {
        return {
          status: 400 as const,
          body: { message: 'Version number only allowed for single environment' }
        };
      }

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
            : eq(Schema.environmentAccess.accessTokenId, req.requester.accessTokenId),
          with: {
            decryptionData: true,
            environment: {
              with: {
                organization:  true,
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
  } else if(environmentId) {
    // Get environment by ID
    const [_organization, _project, environmentById] = await getEnvironmentById(
      environmentId, { requester: req.requester }
    );
    if(!environmentById) {
      return {
        status: 404 as const,
        body: { message: 'Environment not found' }
      };
    }
    environments = [environmentById];
  }

    if(!environments) {
      return {
        status: 404 as const,
        body: { message: 'No environments found' }
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

        const decryptionData = e.access.decryptionData.find(d => d.publicKeyId === pubkey);
        if (!environmentVersion) return {
          ...e,
          version: null,
          decryptionData: decryptionData ? {
            wrappedEncryptionKey: decryptionData.encryptedSymmetricKey.toString('base64'),
            ephemeralPublicKey: decryptionData.ephemeralPublicKey.toString('base64')
          } : null,
          accessControl: {
            users: accessControl.length > 0 ? accessControl.map(a => a.users) : undefined
          },
        } satisfies EnvironmentWithVersion;

        // TODO: return helpful error if user doesn't have access to the variable group
        const variableGroups = e.projectId ? await db.query.environmentVariableGroups.findMany({  
          where: eq(Schema.environmentVariableGroups.requiredByEnvironmentVersionId, environmentVersion.id),
          with: {
            variableGroup: {
              with: {
                environment: {
                  with: {
                    // Check that user has view access to the variable group
                    access: {
                      where: isUserRequester(req.requester)
                      ? eq(Schema.environmentAccess.userId, req.requester.userId)
                      : eq(Schema.environmentAccess.accessTokenId, req.requester.accessTokenId)
                    }
                  }
                }
              }
            }
          }
        }) : null;

        return {
          ...e,
          version: {
            ...environmentVersion,
            content: environmentVersion.encryptedContent.toString('base64'),
            keys: environmentVersion.keys.map(k => k.key),
            versionNumber: totalVersions[0]?.count ?? 1,
            variableGroups: variableGroups?.map(vg => ({
              id: vg.variableGroup.id,
              name: vg.variableGroup.environment.name,
              organizationId: vg.variableGroup.environment.organizationId!,
              environmentId: vg.variableGroup.environmentId,
              description: vg.variableGroup.description,
              createdAt: vg.variableGroup.createdAt,
              updatedAt: vg.variableGroup.updatedAt,
            })) ?? null
          } satisfies EnvironmentVersion,
          decryptionData: decryptionData ? {
            wrappedEncryptionKey: decryptionData.encryptedSymmetricKey.toString('base64'),
            ephemeralPublicKey: decryptionData.ephemeralPublicKey.toString('base64')
          } : null,
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
  body: { name, content, decryptionData, environmentType }
}: { 
  req: TsRestRequest<typeof contract.environments.createEnvironment>; 
  body: TsRestRequest<typeof contract.environments.createEnvironment>['body']
}) => {
  const [organization, project] = environmentType.type === 'variableGroup'
  ? [
    await getOrganization({ path: environmentType.variableGroup.organization }, {
      requester: req.requester,
      createEnvironments: true
    }), null] : await getProjectByPath(environmentType.project, {
    requester: req.requester,
    createEnvironments: true
  });
  if(!organization || (!project && environmentType.type !== 'variableGroup')) {
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

      environmentType.type === 'variableGroup'
        ? eq(Schema.environments.organizationId, organization.id)
        : undefined,

      environmentType.type === 'environment' && project
        ? eq(Schema.environments.projectId, project.id)
        : undefined
    )
  });

  if (existingEnvironment) {
    return {
      status: 400 as const,
      body: { message: 'environment already exists' }
    };
  }

  // Create environment and first version
  const environment = await db.transaction(async (tx) => {

      const [newEnvironment] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: environmentType.type === 'environment' && project ? project.id : undefined,
          organizationId: environmentType.type === 'variableGroup' ? organization.id : undefined,
        })
        .returning();

      if (!newEnvironment) return null;

      // Create environment access for the creator with the AES key for the environment wrapped with their public key
      const [environmentAccess] = await tx.insert(Schema.environmentAccess)
        .values({
          environmentId: newEnvironment.id,
          userId: requester.userId,
          write: true,
          expiresAt: null
        }).returning();
      
      if (!environmentAccess) return null;

      if (environmentType.type === 'variableGroup') {
        await tx.insert(Schema.variableGroups)
          .values({
            environmentId: newEnvironment.id,
            description: environmentType.variableGroup.description
          });
      }

      // Create decryption data for the creator with the AES key for the environment wrapped with their public keys
      for(const data of decryptionData) {
        await tx.insert(Schema.environmentDecryptionData)
          .values({
            environmentAccessId: environmentAccess.id,
            publicKeyId: data.publicKeyBase64,
            ephemeralPublicKey: Buffer.from(data.ephemeralPublicKey, 'base64'),
            encryptedSymmetricKey: Buffer.from(data.wrappedEncryptionKey, 'base64')
          });
      }
      
      // Create the first version of the environment with entries for each key
      const [firstVersion] = await tx.insert(Schema.environmentVersions)
        .values({
          environmentId: newEnvironment.id,
          encryptedContent: Buffer.from(content.ciphertext, 'base64'),
          savedBy: requester.userId
        }).returning();

      if (!firstVersion) return null;
      if (content.keys && content.keys.length > 0) {
        await tx.insert(Schema.environmentVersionKeys)
          .values(content.keys.map(key => ({
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
  body: { content, rollbackToVersionId }
}: {
  req: TsRestRequest<typeof contract.environments.updateEnvironmentContent>;
  params: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['params'];
  body: TsRestRequest<typeof contract.environments.updateEnvironmentContent>['body']
}) => {

  // Find the public key
  const pubkey = await getRequesterPublicKey(content.signature.pubkeyBase64, req.requester)
  if (!pubkey) {
    return {
      status: 400 as const,
      body: { message: 'User public key is not available for verification' }
    };
  }

  // Verify the signature on the ciphertext
  const signatureVerification = verifySignature(content.ciphertext, content.signature, pubkey.content);
  if (!signatureVerification.valid) {
    return {
      status: 400 as const,
      body: { message: signatureVerification.error || 'Invalid signature' }
    };
  }

  const [organization, _, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
    editEnvironment: true
  });
  if(!organization || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }
  
  // Check if the keys are a part of any variable group for the current version.
  // If so, we cannot update the content. User must update the variable group instead.

  const latestVersionOfEnvironment = await db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, environment.id),
    orderBy: desc(Schema.environmentVersions.createdAt),
    with: {
      keys: true
    }
  });
  if (!latestVersionOfEnvironment) {
    return {
      status: 500 as const,
      body: { message: 'Latest version of environment not found' }
    };
  }

  // Get variable groups for the latest version (if environment is not a variable group itself)
  let variableGroupIds: string[] = [];
  
  // If environment is not a variable group itself and not rolling back
  if (environment.projectId) {
    const variableGroups = await db.query.environmentVariableGroups.findMany({
      where: eq(
        Schema.environmentVariableGroups.requiredByEnvironmentVersionId,
        rollbackToVersionId ? rollbackToVersionId : latestVersionOfEnvironment.id
      ),
      with: {
        variableGroup: {
          with: {
            environment: true
          }
        }
      }
    });

    variableGroupIds = variableGroups.map(vg => vg.variableGroupId);

    const addedKeys = content.keys
      .filter(key => !latestVersionOfEnvironment.keys.some(k => k.key === key))
    
    for (const variableGroup of variableGroups) {
      const variableGroupEnvironment = variableGroup.variableGroup.environment;
      const variableGroupEnvironmentVersion = await db.query.environmentVersions.findFirst({
        where: eq(Schema.environmentVersions.environmentId, variableGroupEnvironment.id),
        orderBy: desc(Schema.environmentVersions.createdAt),
        with: {
          keys: true
        }
      });
      if (!variableGroupEnvironmentVersion) {
        return {
          status: 500 as const,
          body: { message: 'Latest version of variable group environment not found' }
        };
      }
      const conflictingKey = variableGroupEnvironmentVersion.keys.find(key => addedKeys.includes(key.key));
      if (conflictingKey && !rollbackToVersionId) {
        return {
          status: 400 as const,
          body: {
            message: `The provided key '${conflictingKey.key}' is part of the variable group '${variableGroupEnvironment.name}'. Update the variable group instead.`
          }
        };
      }
    }
  }

  // No conflicts for provided keys in the variable groups.

  // Update content in transaction
  const updatedVersion = await db.transaction(async (tx) => {
    const [updatedVersion] = await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: environment.id,
        encryptedContent: Buffer.from(content.ciphertext, 'base64'),
        savedBy: isUserRequester(req.requester) ? req.requester.userId : req.requester.accessTokenOwnerId
      })
      .returning();

    if (!updatedVersion) return null;

    // Add entries to environmentVersionKeys for each key
    if (content.keys && content.keys.length > 0) {
      await tx.insert(Schema.environmentVersionKeys)
        .values(content.keys.map(key => ({
          key,
          environmentVersionId: updatedVersion.id,
        })));
    }

    // Inherit variable groups from the previous latest version (if environment is not a variable group itself)
    if (environment.projectId && variableGroupIds.length > 0) {
      await tx.insert(Schema.environmentVariableGroups)
        .values(variableGroupIds.map(vgId => ({
          requiredByEnvironmentVersionId: updatedVersion.id,
          variableGroupId: vgId
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

export const setEnvironmentAccess = async ({
  req,
  params: { idOrPath },
  body: { userOrAccessToken, expiresAt, write, decryptionData, signature }
}: {
  req: TsRestRequest<typeof contract.environments.setEnvironmentAccess>;
  params: TsRestRequest<typeof contract.environments.setEnvironmentAccess>['params'];
  body: TsRestRequest<typeof contract.environments.setEnvironmentAccess>['body']
}) => {
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Environment access management not allowed' }
    };
  }

  // Find the public key
  const pubkey = await getRequesterPublicKey(signature.pubkeyBase64, req.requester)
  if (!pubkey) {
    return {
      status: 400 as const,
      body: { message: 'User public key is not available for verification' }
    };
  }

  // Verify the signature on base64 public keys concatenated, no spaces
  const message = decryptionData.map(d => d.publicKeyBase64).join('');
  const signatureVerification = verifySignature(message, signature, pubkey.content);
  if (!signatureVerification.valid) {
    return {
      status: 400 as const,
      body: { message: signatureVerification.error || 'Invalid signature' }
    };
  }

  // Get environment with write access check and organization with canAddMembers check
  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
    editEnvironment: true, // Ensures write access
    addMembers: true // Ensures canAddMembers permission
  });

  if (!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  const targetUser = await getUserByNameOrId(userOrAccessToken);
  let targetToken: AccessToken | undefined;
  
  // No user, check if it's an access token
  if (!targetUser) {
    targetToken = await db.query.accessTokens.findFirst({
      where: and(
        eq(Schema.accessTokens.name, userOrAccessToken),
        eq(Schema.accessTokens.createdBy, req.requester.userId)
      )
    });

  } 
  
  const roleOwnerId = targetUser?.id ?? targetToken?.createdBy;
  if (!roleOwnerId) {
    return {
      status: 404 as const,
      body: { message: 'No user or access token found' }
    };
  }
  
  // Access token inherits it's owner's role in the organization
  const targetUserRole = await db.query.organizationRoles.findFirst({
    where: eq(Schema.organizationRoles.userId, roleOwnerId)
  });

  if (!targetUserRole) {
    return {
      status: 404 as const,
      body: { message: 'User not found in organization' }
    };
  }

  // Create environment access and decryption data in transaction for user or token
  await db.transaction(async (tx) => {
    const [environmentAccess] = await tx.insert(Schema.environmentAccess).values({
      environmentId: environment.id,
      accessTokenId: targetToken?.id,
      userId: targetUser?.id,
      write: write ?? false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).onConflictDoUpdate({
      target: [
        Schema.environmentAccess.environmentId,
        targetToken ? Schema.environmentAccess.accessTokenId : Schema.environmentAccess.userId
      ],
      set: {
        write: write ?? false,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {})
      }
    }).returning();

    if (!environmentAccess) return;

    for (const data of decryptionData) {
      await tx.insert(Schema.environmentDecryptionData)
        .values({
          environmentAccessId: environmentAccess.id,
          publicKeyId: data.publicKeyBase64,
          ephemeralPublicKey: Buffer.from(data.ephemeralPublicKey, 'base64'),
          encryptedSymmetricKey: Buffer.from(data.wrappedEncryptionKey, 'base64')
        });
    }
  });

  return {
    status: 200 as const,
    body: { message: 'Environment access granted successfully' }
  };
};

export const listEnvironmentAccess = async ({
  req,
  params: { idOrPath }
}: {
  req: TsRestRequest<typeof contract.environments.listEnvironmentAccess>;
  params: TsRestRequest<typeof contract.environments.listEnvironmentAccess>['params'];
}) => {
  // Get environment - no special permissions needed since we're only listing access
  const [_organization, _project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get all access entries for this environment
  const userAccess = await db.select({
    id: Schema.users.id,
    name: Schema.users.name,
    write: Schema.environmentAccess.write
  })
  .from(Schema.environmentAccess)
  .innerJoin(Schema.users, eq(Schema.environmentAccess.userId, Schema.users.id))
  .where(eq(Schema.environmentAccess.environmentId, environment.id));

  const tokenAccess = await db.select({
    id: Schema.accessTokens.id,
    name: Schema.accessTokens.name,
    write: Schema.environmentAccess.write
  })
  .from(Schema.environmentAccess)
  .innerJoin(Schema.accessTokens, eq(Schema.environmentAccess.accessTokenId, Schema.accessTokens.id))
  .where(eq(Schema.environmentAccess.environmentId, environment.id));

  const accessEntries = [
    ...userAccess.map(u => ({ ...u, type: 'user' as const })),
    ...tokenAccess.map(t => ({ ...t, type: 'token' as const }))
  ];

  return {
    status: 200 as const,
    body: {
      users: accessEntries
    }
  };
};

export const deleteEnvironment = async ({
  req,
  params: { idOrPath }
}: {
  req: TsRestRequest<typeof contract.environments.deleteEnvironment>;
  params: TsRestRequest<typeof contract.environments.deleteEnvironment>['params'];
}) => {

  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Environment deletion only via CLI' }
    };
  }

  // Get environment with write access check
  const [_organization, _project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
    editEnvironment: true // Ensures write access
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Finally delete the environment itself
  await db.delete(Schema.environments).where(eq(Schema.environments.id, environment.id));

  return {
    status: 200 as const,
    body: { message: 'Environment deleted successfully' }
  };
};

export const deleteEnvironmentAccess = async ({
  req,
  params: { idOrPath },
  body: { userIdOrName }
}: {
  req: TsRestRequest<typeof contract.environments.deleteEnvironmentAccess>;
  params: TsRestRequest<typeof contract.environments.deleteEnvironmentAccess>['params'];
  body: TsRestRequest<typeof contract.environments.deleteEnvironmentAccess>['body'];
}) => {
  if (!isUserRequester(req.requester)) {
    return {
      status: 403 as const,
      body: { message: 'Environment access management only via CLI' }
    };
  }

  // Get environment with write access check and organization with canAddMembers check
  const [organization, project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester,
    editEnvironment: true, // Ensures write access
    addMembers: true // Ensures canAddMembers permission
  });

  if (!organization || !project || !environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  const targetUser = await getUserByNameOrId(userIdOrName);
  if (!targetUser) {

    // Check if it's an access token
    const targetToken = await db.query.accessTokens.findFirst({
      where: and(
        eq(Schema.accessTokens.name, userIdOrName),
        eq(Schema.accessTokens.createdBy, req.requester.userId)
      )
    });

    if (!targetToken) {
      return {
        status: 404 as const,
        body: { message: 'No user or access token found' }
      };
    }

    await db.delete(Schema.environmentAccess)
      .where(and(
        eq(Schema.environmentAccess.environmentId, environment.id),
        eq(Schema.environmentAccess.accessTokenId, targetToken.id)
      ));

    return {
      status: 200 as const,
      body: { message: 'Environment access removed successfully' }
    };
  }

  // Delete the access entry
  const result = await db.delete(Schema.environmentAccess)
    .where(and(
      eq(Schema.environmentAccess.environmentId, environment.id),
      eq(Schema.environmentAccess.userId, targetUser.id)
    )).returning();

  // Check if any rows were affected
  if (result.length === 0) {
    return {
      status: 404 as const,
      body: { message: 'User does not have access to this environment' }
    };
  }

  return {
    status: 200 as const,
    body: { message: 'Environment access removed successfully' }
  };
};

export const getEnvironmentVersions = async ({
  req,
  params: { idOrPath }
}: {
  req: TsRestRequest<typeof contract.environments.getEnvironmentVersions>;
  params: TsRestRequest<typeof contract.environments.getEnvironmentVersions>['params'];
}) => {
  // Check user access to the environment
  const [_organization, _project, environment] = await getEnvironmentByPath(idOrPath, {
    requester: req.requester
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get all versions for this environment
  const versions = await db.query.environmentVersions.findMany({
    where: eq(Schema.environmentVersions.environmentId, environment.id),
    orderBy: desc(Schema.environmentVersions.createdAt),
    with: {
      keys: true,
      author: true
    }
  });

  // Get total count for version numbering (latest version = total count)
  const totalVersions = await db.select({ count: count() })
    .from(Schema.environmentVersions)
    .where(eq(Schema.environmentVersions.environmentId, environment.id));

  const totalCount = totalVersions[0]?.count ?? 0;

  // Transform versions to match the expected schema (omit content)
  const versionsResponse = versions.map((version, index) => ({
    id: version.id,
    environmentId: version.environmentId,
    author: version.author,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    keys: version.keys.map(k => k.key),
    versionNumber: totalCount - index // Latest version gets highest number
  }));

  return {
    status: 200 as const,
    body: versionsResponse
  };
};

export const addVariableGroup = async ({
  req,
  params,
  body
}: {
  req: TsRestRequest<typeof contract.environments.addVariableGroup>;
  params: TsRestRequest<typeof contract.environments.addVariableGroup>['params'];
  body: TsRestRequest<typeof contract.environments.addVariableGroup>['body'];
}) => {
  const { environmentPath, variableGroupPath } = params;

  // Get environment with write access
  const [organization, _project, environment] = await getEnvironmentByPath(environmentPath, {
    requester: req.requester,
    editEnvironment: true
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get environment of variable group
  const [variableGroupOrganization, _empty, variableGroupEnvironment] = await getEnvironmentByPath(variableGroupPath, {
    requester: req.requester
  });

  if (!variableGroupEnvironment) {
    return {
      status: 404 as const,
      body: { message: 'Variable group not found' }
    };
  }

  // Check that the variable group is in the same organization as the environment
  if (variableGroupOrganization.id !== organization.id) {
    return {
      status: 400 as const,
      body: { message: 'Variable group is not in the same organization as the environment' }
    };
  }

  // Verify the variable group exists and user has access to it
  // TODO: access
  const variableGroup = await db.query.variableGroups.findFirst({
    where: eq(Schema.variableGroups.environmentId, variableGroupEnvironment.id),
  });


  if (!variableGroup) {
    return {
      status: 404 as const,
      body: { message: 'Variable group not found or no access' }
    };
  }

  // Get the latest version of the current environment
  const latestVersion = await db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, environment.id),
    orderBy: desc(Schema.environmentVersions.createdAt),
    with: {
      keys: true,
      requiresVariableGroups: true
    }
  });

  if (!latestVersion) {
    return {
      status: 500 as const,
      body: { message: 'No versions found for environment' }
    };
  }

  // Check if variable group is already attached to the latest version
  const existingAttachment = latestVersion.requiresVariableGroups.find(
    vg => vg.variableGroupId === variableGroup.id
  );

  if (existingAttachment) {
    return {
      status: 400 as const,
      body: { message: 'Variable group already attached to latest version' }
    };
  }

  // Create new version copying content from the latest version and add variable group attachment
  const newVersion = await db.transaction(async (tx) => {
    // Create new environment version with same content as latest
    const [newVersion] = await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: environment.id,
        encryptedContent: latestVersion.encryptedContent,
        savedBy: isUserRequester(req.requester) ? req.requester.userId : req.requester.accessTokenOwnerId
      })
      .returning();

    if (!newVersion) return null;

    // Copy all keys from the previous version
    if (latestVersion.keys.length > 0) {
      await tx.insert(Schema.environmentVersionKeys)
        .values(latestVersion.keys.map(key => ({
          key: key.key,
          environmentVersionId: newVersion.id,
        })));
    }

    // Copy all existing variable group attachments from the previous version
    if (latestVersion.requiresVariableGroups.length > 0) {
      await tx.insert(Schema.environmentVariableGroups)
        .values(latestVersion.requiresVariableGroups.map(vg => ({
          requiredByEnvironmentVersionId: newVersion.id,
          variableGroupId: vg.variableGroupId
        })));
    }

    // Add the new variable group attachment
    await tx.insert(Schema.environmentVariableGroups)
      .values({
        requiredByEnvironmentVersionId: newVersion.id,
        variableGroupId: variableGroup.id
      });

    return newVersion;
  });

  if (!newVersion) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create new environment version' }
    };
  }

  return {
    status: 200 as const,
    body: { message: 'Variable group attached successfully' }
  };
};

export const removeVariableGroup = async ({
  req,
  params
}: {
  req: TsRestRequest<typeof contract.environments.removeVariableGroup>;
  params: TsRestRequest<typeof contract.environments.removeVariableGroup>['params'];
}) => {
  const { environmentPath, variableGroupPath } = params;

  // Get environment with write access
  const [organization, _project, environment] = await getEnvironmentByPath(environmentPath, {
    requester: req.requester,
    editEnvironment: true
  });

  if (!environment) {
    return {
      status: 404 as const,
      body: { message: 'Environment not found' }
    };
  }

  // Get environment of variable group
  const [variableGroupOrganization, _empty, variableGroupEnvironment] = await getEnvironmentByPath(variableGroupPath, {
    requester: req.requester
  });

  if (!variableGroupEnvironment) {
    return {
      status: 404 as const,
      body: { message: 'Variable group not found' }
    };
  }

  // Check that the variable group is in the same organization as the environment
  if (variableGroupOrganization.id !== organization.id) {
    return {
      status: 400 as const,
      body: { message: 'Variable group is not in the same organization as the environment' }
    };
  }

  // Verify the variable group exists and user has access to it
  // TODO: access
  const variableGroup = await db.query.variableGroups.findFirst({
    where: eq(Schema.variableGroups.environmentId, variableGroupEnvironment.id),
  });

  if (!variableGroup) {
    return {
      status: 404 as const,
      body: { message: 'Variable group not found or no access' }
    };
  }

  // Get the latest version of the current environment
  const latestVersion = await db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, environment.id),
    orderBy: desc(Schema.environmentVersions.createdAt),
    with: {
      keys: true,
      requiresVariableGroups: true
    }
  });

  if (!latestVersion) {
    return {
      status: 500 as const,
      body: { message: 'No versions found for environment' }
    };
  }

  // Check if variable group is attached to the latest version
  const existingAttachment = latestVersion.requiresVariableGroups.find(
    vg => vg.variableGroupId === variableGroup.id
  );

  if (!existingAttachment) {
    return {
      status: 400 as const,
      body: { message: 'Variable group is not attached to the latest version' }
    };
  }

  // Create new version copying content from the latest version but exclude the variable group
  const newVersion = await db.transaction(async (tx) => {
    // Create new environment version with same content as latest
    const [newVersion] = await tx.insert(Schema.environmentVersions)
      .values({
        environmentId: environment.id,
        encryptedContent: latestVersion.encryptedContent,
        savedBy: isUserRequester(req.requester) ? req.requester.userId : req.requester.accessTokenOwnerId
      })
      .returning();

    if (!newVersion) return null;

    // Copy all keys from the previous version
    if (latestVersion.keys.length > 0) {
      await tx.insert(Schema.environmentVersionKeys)
        .values(latestVersion.keys.map(key => ({
          key: key.key,
          environmentVersionId: newVersion.id,
        })));
    }

    // Copy all existing variable group attachments from the previous version EXCEPT the one to remove
    const variableGroupsToKeep = latestVersion.requiresVariableGroups.filter(
      vg => vg.variableGroupId !== variableGroup.id
    );

    if (variableGroupsToKeep.length > 0) {
      await tx.insert(Schema.environmentVariableGroups)
        .values(variableGroupsToKeep.map(vg => ({
          requiredByEnvironmentVersionId: newVersion.id,
          variableGroupId: vg.variableGroupId
        })));
    }

    return newVersion;
  });

  if (!newVersion) {
    return {
      status: 500 as const,
      body: { message: 'Failed to create new environment version' }
    };
  }

  return {
    status: 200 as const,
    body: { message: 'Variable group removed successfully' }
  };
};

export const getVariableGroupInfo = async ({
  req,
  params: { variableGroupId },
}: {
  req: TsRestRequest<typeof contract.environments.getVariableGroupInfo>;
  params: TsRestRequest<typeof contract.environments.getVariableGroupInfo>['params'];
}) => {
  
  // Find variable group by environment ID
  const variableGroup = await db.query.variableGroups.findFirst({
    where: eq(Schema.variableGroups.environmentId, variableGroupId),
    with: {
      environment: {
        with: {
          organization: true
        }
      }
    }
  });


  if (!variableGroup) {
    return {
      status: 404 as const,
      body: { message: 'Variable group not found' }
    };
  }

  // Check if user has access to the variable group's organization
  const hasAccess = await db.query.organizationRoles.findFirst({
    where: and(
      eq(Schema.organizationRoles.organizationId, variableGroup.environment.organization!.id),
      isUserRequester(req.requester) 
        ? eq(Schema.organizationRoles.userId, req.requester.userId)
        : eq(Schema.organizationRoles.userId, req.requester.accessTokenOwnerId!)
    )
  });

  if (!hasAccess) {
    return {
      status: 403 as const,
      body: { message: 'Access denied' }
    };
  }

  // 1. Get all environment versions that use this variable group
  const environmentVariableGroups = await db.query.environmentVariableGroups.findMany({
    where: eq(Schema.environmentVariableGroups.variableGroupId, variableGroup.id),
    with: {
      requiredByEnvironmentVersion: {
        with: {
          environment: true
        }
      }
    }
  });

  // 2. Collect all environment version IDs in a map
  const versionIdsWithVariableGroup = new Set(
    environmentVariableGroups.map(evg => evg.requiredByEnvironmentVersionId)
  );

  // 3. Get unique environments and find their latest versions
  const uniqueEnvironments = new Map<string, Environment>();
  environmentVariableGroups.forEach(evg => {
    const env = evg.requiredByEnvironmentVersion.environment;
    if (env && env.projectId) { // Only regular environments, not variable groups
      uniqueEnvironments.set(env.id, env);
    }
  });

  const finalResults = [];
  
  // 4. For each environment, check if its latest version has the variable group
  for (const [envId, environment] of uniqueEnvironments) {
    const latestVersion = await db.query.environmentVersions.findFirst({
      where: eq(Schema.environmentVersions.environmentId, envId),
      orderBy: desc(Schema.environmentVersions.createdAt),
      with: {
        environment: {
          with: {
            project: true
          }
        }
      }
    });

    if (latestVersion && versionIdsWithVariableGroup.has(latestVersion.id)) {
        finalResults.push({
          environmentId: environment.id,
          environmentName: environment.name,
          projectId: environment.projectId!,
          projectName: latestVersion.environment?.project?.name ?? 'N/A',
          appliedAt: latestVersion.createdAt
        });
    }
  }

  return {
    status: 200 as const,
    body: {
      variableGroup: {
        id: variableGroup.id,
        name: variableGroup.environment.name,
        description: variableGroup.description,
        organizationId: variableGroup.environment.organization!.id,
        createdAt: variableGroup.createdAt,
        updatedAt: variableGroup.updatedAt
      },
      appliedToEnvironments: finalResults
    }
  };
};
