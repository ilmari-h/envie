import { db, Environment, EnvironmentAccess, EnvironmentDecryptionData, Schema, AccessToken } from '@repo/db';
import { eq, and, count } from 'drizzle-orm';
import { TsRestRequest } from '@ts-rest/express';
import { contract } from '@repo/rest';
import type { EnvironmentVersion, EnvironmentWithVersion } from '@repo/rest';
import { getEnvironmentByPath, getOrganizationEnvironments, getProjectByPath, getProjectEnvironments } from '../queries/by-path';
import { isUserRequester } from '../types/cast';
import { getEnvironmentVersionByIndex } from '../queries/environment-version';
import { getUserByNameOrId } from '../queries/user';
import { ed25519 } from '@noble/curves/ed25519';
import { getRequesterPublicKey } from '../queries/public-key';

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

export const getEnvironments = async ({ req, query: { path, version, pubkey } }:
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

    let environments: (Environment & { access: EnvironmentAccess & { decryptionData: EnvironmentDecryptionData[] } })[] = [];
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
  body: { name, project, content, decryptionData }
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

  // Create environment and first version if tent is provided.
  const environment = await db.transaction(async (tx) => {

      const [newEnvironment] = await tx.insert(Schema.environments)
        .values({
          name,
          projectId: projectDb.id
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
  body: { content }
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
