import { initContract } from '@ts-rest/core';
import { z } from 'zod';


const parseDate = (date: string) => {
  const parsed = new Date(date);
  try {
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid date');
    }
  } catch (error) {
    throw new Error('Invalid date');
  }

  return parsed;
}

const stringToDateSchema = z.string().refine(parseDate, { message: 'Invalid date' }).transform(parseDate);
const nameRegex = /^[a-zA-Z0-9_-]+$/;
const nameSchema = z.string()
  .min(1)
  .max(32)
  .regex(nameRegex, 'Name can only contain latin letters, numbers, underscores and hyphens')

export const invitedUserSchema = z.object({
  userId: z.string(),
  wrappedAesKey: z.string(),
  ephemeralPublicKey: z.string()
});

export const signatureSchema = z.object({
  pubkeyBase64: z.string(),
  signature: z.string(),
  algorithm: z.enum(['ecdsa', 'rsa'])
})

// Zod schemas for DB types
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  organization: organizationSchema
});

export const environmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectId: z.string().uuid(),
  preservedVersions: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
  project: projectSchema
});

export const environmentVersionSchema = z.object({
  id: z.string().uuid(),
  environmentId: z.string().uuid().nullable(),
  savedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  content: z.string(),
  keys: z.array(z.string()),
  versionNumber: z.number().int(),
});

export const envrionmentVersionWithWrappedEncryptionKeySchema = environmentVersionSchema.extend({
  decryptionData: z.object({
    wrappedEncryptionKey: z.string(),
    ephemeralPublicKey: z.string()
  })
});

export const environmentWithVersionSchema = environmentSchema.extend({
  version: environmentVersionSchema.nullable(),
  decryptionData: z.object({
    wrappedEncryptionKey: z.string(),
    ephemeralPublicKey: z.string()
  }).nullable(),
  accessControl: z.object({
    users: z.array(userSchema).optional()
  })
});

export const organizationWithProjectsCountSchema = organizationSchema.extend({
  projects: z.number().int()
});

const c = initContract();

export type EnvironmentVersion = z.infer<typeof environmentVersionSchema>;
export type EnvironmentVersionWithWrappedEncryptionKey = z.infer<typeof envrionmentVersionWithWrappedEncryptionKeySchema>;
export type EnvironmentWithVersion = z.infer<typeof environmentWithVersionSchema>;

export type OrganizationWithProjectsCount = z.infer<typeof organizationWithProjectsCountSchema>;

const health = c.router({
  getHealth: {
    method: 'GET',
    path: '/health',
    responses: {
      200: c.type<{ status: 'ok' }>()
    }
  }
});

const publicKeys = c.router({
  getPublicKeys: {
    method: 'GET',
    path: '/public-keys/:userOrTokenNameOrId',
    pathParams: z.object({
      userOrTokenNameOrId: z.string()
    }),
    responses: {
      200: z.object({
        publicKeys: z.array(z.object({
          valueBase64: z.string(),
          algorithm: z.enum(['ed25519', 'rsa'])
        }))
      }),
      404: c.type<{ message: string }>(),
    }
  },
  setPublicKey: {
    method: 'POST',
    summary: 'Set the public key for the calling user or access token.',
    path: '/public-keys',
    body: z.object({
      publicKey: z.object({
        name: z.string(),
        valueBase64: z.string(),
        algorithm: z.enum(['ed25519', 'rsa'])
      }),
      existingEnvironmentAccessForNewKey: z.array(z.object({
          environmentId: z.string(),
          ephemeralPublicKey: z.string(),
          encryptedSymmetricKey: z.string(),
        })
      ).optional(),
    }),
    responses: {
      200: c.type<{ message: string }>(),
      403: c.type<{ message: string }>(),
      400: c.type<{ message: string }>()
    }
  },
  getDecryptionKeys: {
    method: 'GET',
    summary: 'Get environment decryption keys for the given public key',
    path: '/public-keys/:pubkeyBase64Url/dek',
    pathParams: z.object({
      pubkeyBase64Url: z.string(),
    }),
    query: z.object({
      environment: z.string().optional(),
    }),
    responses: {
      200: z.object({
        deks: z.array(z.object({
          environmentId: z.string(),
          wrappedDek: z.string(),
          ephemeralPublicKey: z.string(),
          algorithm: z.enum(['x25519', 'rsa'])
        }))
      })
    }
  }
  // removePublicKey: {
  //   method: 'DELETE',
  //   path: '/public-keys/:pubKeyBase64',
  //   pathParams: z.object({
  //     pubKeyBase64: z.string()
  //   }),
  //   responses: {
  //     200: c.type<{ message: string }>(),
  //     403: c.type<{ message: string }>(),
  //     400: c.type<{ message: string }>()
  //   }
  // }
})

const user = c.router({
  getUser: {
    method: 'GET',
    path: '/users/me',
    responses: {
      // User
      200: z.object({
        id: z.string(),
        name: z.string(),
        authMethod: z.enum(['github', 'email', 'token']),
        publicKeys: z.array(z.object({
          valueBase64: z.string(),
          name: z.string(),
          algorithm: z.enum(['ed25519', 'rsa'])
        })),
      }),
      401: c.type<{ message: string }>(),
      404: c.type<{ message: string }>()
    }
  },
  updateName: {
    method: 'POST',
    path: '/users/me/name',
    body: z.object({
      name: nameSchema
    }),
    responses: {
      200: c.type<{ message: string }>(),
      403: c.type<{ message: string }>(),
      400: c.type<{ message: string }>()
    }
  }
});

const projects = c.router({
  // getProjectByInvite: {
  //   method: 'GET',
  //   path: '/projects/invite/:inviteId',
  //   pathParams: z.object({
  //     inviteId: z.string()
  //   }),
  //   responses: {
  //     200: z.object({
  //       project: z.object({
  //         id: z.string(),
  //         name: z.string(),
  //         description: z.string().nullable(),
  //         organizationId: z.string(),
  //         createdAt: z.date(),
  //         updatedAt: z.date()
  //       }),
  //       invite: z.object({
  //         oneTimeUse: z.boolean(),
  //         expiresAt: z.date()
  //       })
  //     }),
  //     404: z.object({ message: z.string() })
  //   }
  // },
  getProject: {
    method: 'GET',
    path: '/projects/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: projectSchema,
      401: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  getProjects: {
    method: 'GET',
    path: '/projects',
    query: z.object({
      organization: z.string().optional(),
    }),
    responses: {
      200: projectSchema.array()
    }
  },
  createProject: {
    method: 'POST',
    path: '/projects',
    body: z.object({
      name: nameSchema,
      description: z.string(),
      organizationIdOrName: z.string(),
    }),
    responses: {
      201: projectSchema.omit({ organization: true }),
      403: z.object({ message: z.string() })
    }
  },
  updateProject: {
    method: 'PUT',
    path: '/projects/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({
      name: nameSchema,
      description: z.string(),
    }),
    responses: {
      200: projectSchema.omit({ organization: true }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },

  deleteProject: {
    method: 'DELETE',
    path: '/projects/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  }
})

const environments = c.router({
  getEnvironments: {
    method: 'GET',
    path: '/environments',
    query: z.object({
      path: z.string().optional(),
      pubkey: z.string().optional().describe('If single environment is requested, specifies the public key to use for decryption'),
      version: z.string()
        .optional()
        .describe('If single environment is requested, specifies the version')
        .refine(v => !v || !isNaN(parseInt(v)), {
          message: 'Version must be a number'
        })
        .refine(v => !v || parseInt(v) > 0, {
          message: 'Version must be a positive number'
        })
    }),
    responses: {
      200: environmentWithVersionSchema.array()
    },
    summary: 'Get environments for current user, optionally filtered by project or environment id'
  },
  createEnvironment: {
    method: 'POST',
    path: '/environments',
    body: z.object({
      name: nameSchema,
      project: z.string(),
      content: z.object({
        keys: z.array(z.string()),
        ciphertext: z.string(),

        // PKE protocol - we validate that the caller matches his public key on record
        // Message = ciphertext
        signature: signatureSchema
      }),

      decryptionData: z.array(z.object({
        publicKeyBase64: z.string(),
        wrappedEncryptionKey: z.string(),
        ephemeralPublicKey: z.string()
      })),
    }),
    responses: {
      201: z.object({ message: z.string() }),
      400: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Create a new environment'
  },

  updateEnvironmentContent: {
    method: 'PUT',
    path: '/environments/:idOrPath/content',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({

      // The public key used to encrypt the content
      content: z.object({
        keys: z.array(z.string()),
        ciphertext: z.string(),

        // PKE protocol - we validate that the caller matches his public key on record
        // Message = ciphertext
        signature: signatureSchema
      }),
    }),
    responses: {
      200: z.object({}),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update environment content'
  },

  deleteEnvironment: {
    method: 'DELETE',
    path: '/environments/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: z.object({}),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update environment content'
  },

  updateEnvironmentSettings: {
    method: 'PUT',
    path: '/environments/:idOrPath/settings',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({
      preserveVersions: z.number().min(5).max(100).optional()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update environment settings'
  },

  setEnvironmentAccess: {
    method: 'PUT',
    path: '/environments/:idOrPath/access',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({
      userOrAccessToken: z.string(),
      expiresAt: stringToDateSchema.optional(),
      write: z.boolean().optional(),

      decryptionData: z.array(z.object({
        publicKeyBase64: z.string(),
        wrappedEncryptionKey: z.string(),
        ephemeralPublicKey: z.string()
      })),
      
      // PKE protocol - we validate that the caller matches his public key on record
      // Message = base64 public keys concatenated, no spaces (in same order as in `decryptionData`)
      signature: signatureSchema
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Set access for a user in an environment'
  },

  listEnvironmentAccess: {
    method: 'GET',
    path: '/environments/:idOrPath/access',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: z.object({
        users: z.array(z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(['user', 'token']),
          write: z.boolean(),
        }))
      }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Set access for a user in an environment'
  },

  deleteEnvironmentAccess: {
    method: 'DELETE',
    path: '/environments/:idOrPath/access',
    pathParams: z.object({
      idOrPath: z.string(),
    }),
    body: z.object({
      userIdOrName: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Remove user access from an environment'
  },
})

export const organizations = c.router({
  getOrganizations: {
    method: 'GET',
    path: '/organizations',
    responses: {
      200: organizationWithProjectsCountSchema.array()
    },
    summary: 'Get all organizations the current user is a member of'
  },
  getOrganizationMembers: {
    method: 'GET',
    path: '/organizations/:idOrPath/members',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: z.array(z.object({
        id: z.string(),
        name: z.string(),
        permissions: z.object({
          canAddMembers: z.boolean(),
          canCreateEnvironments: z.boolean(),
          canCreateProjects: z.boolean(),
          canEditProject: z.boolean(),
          canEditOrganization: z.boolean()
        })
      })),
      404: z.object({ message: z.string() })
    },
    summary: 'Get all members of an organization'
  },
  updateAccess: {
    method: 'PUT',
    path: '/organizations/:idOrPath/access',
    pathParams: z.object({
      idOrPath: z.string(),
    }),
    body: z.object({
          userIdOrName: z.string(),
          canAddMembers: z.boolean().optional(),
          canCreateEnvironments: z.boolean().optional(),
          canCreateProjects: z.boolean().optional(),
          canEditProject: z.boolean().optional(),
          canEditOrganization: z.boolean().optional()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update access for a user in an organization'
  },
  createOrganizationInvite: {
    method: 'POST',
    path: '/organizations/:idOrPath/invites',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({
      oneTimeUse: z.boolean().optional().default(true),
      expiresAt: stringToDateSchema
    }),
    responses: {
      201: z.object({
        token: z.string(),
        expiresAt: z.date(),
        inviteUrl: z.string()
      }),
      400: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() }),
      500: z.object({ message: z.string() })
    },
    summary: 'Create an organization invite'
  },
  acceptOrganizationInvite: {
    method: 'GET',
    path: '/organizations/:name/invites/:token/accept',
    pathParams: z.object({
      name: z.string(),
      token: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      400: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() }),
      500: z.object({ message: z.string() })
    },
    summary: 'Accept an organization invite'
  },
  updateOrganization: {
    method: 'PUT',
    path: '/organizations/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    body: z.object({
      name: nameSchema,
      description: z.string().optional()
    }),
    responses: {
      200: organizationSchema,
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update an organization'
  },

  getOrganization: {
    method: 'GET',
    path: '/organizations/:idOrPath',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: organizationSchema,
      401: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Get an organization'
  },
  createOrganization: {
    method: 'POST',
    path: '/organizations',
    body: z.object({
      name: nameSchema,
      description: z.string().optional()
    }),
    responses: {
      201: organizationSchema,
      403: z.object({ message: z.string() })
    },
    summary: 'Create a new organization'
  },

  getOrganizationByInvite: {
    method: 'GET',
    path: '/organizations/invites/:token/info',
    pathParams: z.object({
      token: z.string()
    }),
    responses: {
      200: z.object({ 
        name: z.string(),
        id: z.string() 
      }),
      404: z.object({ message: z.string() })
    },
    summary: 'Get organization info from invite token'
  },

  listOrganizationInvites: {
    method: 'GET',
    path: '/organizations/:idOrPath/invites',
    pathParams: z.object({
      idOrPath: z.string()
    }),
    responses: {
      200: z.array(z.object({
        link: z.string(),
        token: z.string(),
        createdBy: z.string(),
        createdAt: z.date(),
        expiresAt: z.date(),
        oneTimeUse: z.boolean()
      })),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'List all invites for an organization'
  },

  deleteOrganizationInvite: {
    method: 'DELETE',
    path: '/organizations/:idOrPath/invites/:token',
    pathParams: z.object({
      idOrPath: z.string(),
      token: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Delete an organization invite'
  }
})

export const accessTokens = c.router({
  getAccessTokens: {
    method: 'GET',
    path: '/access-tokens',
    responses: {
      200: z.array(z.object({
        name: z.string(),
        expiresAt: z.date().nullable(),
        pubkeyBase64: z.string()
      }))
    }
  },
  deleteAccessToken: {
    method: 'DELETE',
    path: '/access-tokens/:name',
    pathParams: z.object({
      name: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() })
    }
  },
  createAccessToken: {
    method: 'POST',
    path: '/access-tokens',
    body: z.object({
      name: nameSchema,
      expiresAt: stringToDateSchema.optional(),
      publicKey: z.object({
        valueBase64: z.string(),
        algorithm: z.enum(['ed25519', 'rsa'])
      }),
    }),
    responses: {
      201: z.object({ tokenValue: z.string() }),
      400: z.object({ message: z.string() }),
      403: z.object({ message: z.string() })
    }
  }
})

export const contract = c.router({
  health,
  environments,
  organizations,
  user,
  projects,
  publicKeys,
  accessTokens
});
