import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Environment, EnvironmentVersion as DBEnvironmentVersion, Organization, Project, User } from '@repo/db';

// Zod schemas for DB types
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdById: z.string().uuid().nullable(),
  hobby: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const environmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  freeForm: z.boolean(),
  projectId: z.string().uuid(),
  preservedVersions: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const environmentVersionSchema = z.object({
  id: z.string().uuid(),
  environmentId: z.string().uuid().nullable(),
  savedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  content: z.string(),
  versionNumber: z.number().int()
});

export const environmentWithLatestVersionSchema = environmentSchema.extend({
  latestVersion: environmentVersionSchema.nullable(),
  accessControl: z.object({
    projectWide: z.boolean(),
    users: z.array(userSchema).optional()
  })
});

export const projectWithUsersSchema = projectSchema.extend({
  users: z.array(userSchema)
});

export const organizationWithProjectsCountSchema = organizationSchema.extend({
  projects: z.number().int()
});

const c = initContract();


export type EnvironmentVersion = z.infer<typeof environmentVersionSchema>;
export type EnvironmentWithLatestVersion = z.infer<typeof environmentWithLatestVersionSchema>;

export type ProjectWithUsers = z.infer<typeof projectWithUsersSchema>;

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
      200: c.type<{ id: string, name: string }>()
    }
  }
});

const projects = c.router({
  getProjectByInvite: {
    method: 'GET',
    path: '/projects/invite/:inviteId',
    pathParams: z.object({
      inviteId: z.string()
    }),
    responses: {
      200: z.object({
        project: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          organizationId: z.string(),
          createdAt: z.date(),
          updatedAt: z.date()
        }),
        invite: z.object({
          oneTimeUse: z.boolean(),
          expiresAt: z.date()
        })
      }),
      404: z.object({ message: z.string() })
    }
  },
  getProject: {
    method: 'GET',
    path: '/projects/:id',
    pathParams: z.object({
      id: z.string()
    }),
    responses: {
      200: projectWithUsersSchema,
      401: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  getProjects: {
    method: 'GET',
    path: '/projects',
    query: z.object({
      organizationId: z.string().optional(),
    }),
    responses: {
      200: projectSchema.array()
    }
  },
  createProject: {
    method: 'POST',
    path: '/projects',
    body: z.object({
      name: z.string(),
      description: z.string(),
      organizationId: z.string(),
      defaultEnvironments: z.array(z.string()).optional()
    }),
    responses: {
      201: projectSchema,
      403: z.object({ message: z.string() })
    }
  },
  updateProject: {
    method: 'PUT',
    path: '/projects/:id',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      name: z.string(),
      description: z.string(),
    }),
    responses: {
      200: projectSchema,
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  generateInviteLink: {
    method: 'POST',
    path: '/projects/:id/invite',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      oneTimeUse: z.boolean(),
      expiresAt: z.coerce.date(),
    }),
    responses: {
      200: z.object({ link: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  acceptInviteLink: {
    method: 'GET',
    path: '/invite/accept/:inviteId',
    pathParams: z.object({
      inviteId: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      302: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  removeInviteLinks: {
    method: 'DELETE',
    path: '/projects/:id/invite',
    pathParams: z.object({
      id: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  removeUser: {
    method: 'DELETE',
    path: '/projects/:id/users/:userId',
    pathParams: z.object({
      id: z.string(),
      userId: z.string()
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    }
  },
  deleteProject: {
    method: 'DELETE',
    path: '/projects/:id',
    pathParams: z.object({
      id: z.string()
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
      projectId: z.string().optional(),
      environmentId: z.string().optional()
    }),
    responses: {
      200: environmentWithLatestVersionSchema.array()
    },
    summary: 'Get environments for current user, optionally filtered by project or environment id'
  },

  getEnvironmentVersion: {
    method: 'GET',
    path: '/environments/:id/versions/:versionNumber',
    pathParams: z.object({
      id: z.string(),
      versionNumber: z.string().optional()
    }),
    responses: {
      200: environmentVersionSchema
    },
    summary: 'Get a specific version of an environment'
  },
  createEnvironment: {
    method: 'POST',
    path: '/environments',
    body: z.object({
      name: z.string(),
      projectId: z.string(),
      content: z.string().optional(),
      allowedUserIds: z.array(z.string()).optional()
    }),
    responses: {
      201: environmentWithLatestVersionSchema,
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Create a new environment'
  },

  updateEnvironmentContent: {
    method: 'PUT',
    path: '/environments/:id/content',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      content: z.string()
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
    path: '/environments/:id/settings',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      allowedUserIds: z.array(z.string()).describe("If empty array, allow access to all users in the project").optional(),
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
    path: '/organizations/:id',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      name: z.string(),
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
    path: '/organizations/:id',
    pathParams: z.object({
      id: z.string()
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
      name: z.string(),
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
