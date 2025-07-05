import { initContract } from '@ts-rest/core';
import { z } from 'zod';

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

export const environmentWithLatestVersionSchema = environmentSchema.extend({
  latestVersion: environmentVersionSchema.nullable(),
  decryptionData: z.object({
    wrappedEncryptionKey: z.string(),
    ephemeralPublicKey: z.string()
  }),
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
export type EnvironmentWithLatestVersion = z.infer<typeof environmentWithLatestVersionSchema>;

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

const user = c.router({
  getUser: {
    method: 'GET',
    path: '/users/me',
    responses: {
      200: z.object({
        id: z.string(),
        name: z.string(),
        authMethod: z.enum(['github', 'email']),
        publicKey: z.string().nullable(),
        pkeAlgorithm: z.enum(['x25519', 'rsa']).nullable()
      }).or(z.object({
        message: z.string()
      })),
      401: c.type<{ message: string }>()
    }
  },
  setPublicKey: {
    method: 'POST',
    path: '/users/me/public-key',
    body: z.object({
      publicKey: z.string(),
      allowOverride: z.boolean().optional().default(false)
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
  // acceptInviteLink: {
  //   method: 'GET',
  //   path: '/invite/accept/:inviteId',
  //   pathParams: z.object({
  //     inviteId: z.string()
  //   }),
  //   responses: {
  //     200: z.object({ message: z.string() }),
  //     302: z.object({ message: z.string() }),
  //     403: z.object({ message: z.string() }),
  //     404: z.object({ message: z.string() })
  //   }
  // },
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
      path: z.string().optional()
    }),
    responses: {
      200: environmentWithLatestVersionSchema.array()
    },
    summary: 'Get environments for current user, optionally filtered by project or environment id'
  },

  getEnvironmentVersion: {
    method: 'GET',
    path: '/environments/:idOrPath/versions/:versionNumber',
    pathParams: z.object({
      idOrPath: z.string(),
      versionNumber: z.string().optional()
    }),
    responses: {
      200: envrionmentVersionWithWrappedEncryptionKeySchema
    },
    summary: 'Get a specific version of an environment'
  },
  createEnvironment: {
    method: 'POST',
    path: '/environments',
    body: z.object({
      name: nameSchema,
      project: z.string(),
      encryptedContent: z.object({
        keys: z.array(z.string()),
        ciphertext: z.string()
      }),
      invitedUsers: z.array(invitedUserSchema).optional(),
      userWrappedAesKey: z.string(),
      userEphemeralPublicKey: z.string()
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
      encryptedContent: z.object({
        keys: z.array(z.string()),
        ciphertext: z.string()
      }),
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
  }
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
  }
})

export const contract = c.router({
  health,
  environments,
  organizations,
  user,
  projects
});
