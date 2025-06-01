import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Environment, EnvironmentVersion as DBEnvironmentVersion, Organization, Project, User } from '@repo/db';

const c = initContract();

export type EnvironmentVersion = Omit<DBEnvironmentVersion, 'encryptedContent'> & { content: string, versionNumber: number };
export type EnvironmentWithLatestVersion = Environment & {
  latestVersion: EnvironmentVersion | null;
  accessControl: {
    projectWide: boolean;
    users?: User[];
  };
};

export type ProjectWithUsers = Project & {
  users: User[];
};

export type OrganizationWithProjectsCount = Organization & {
  projects: number;
};

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
      200: c.type<ProjectWithUsers>(),
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
      200: c.type<Project[]>()
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
      201: c.type<Project>(),
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
      200: c.type<Project>(),
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
      200: c.type<EnvironmentWithLatestVersion[]>()
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
      200: c.type<EnvironmentVersion>()
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
      201: c.type<EnvironmentWithLatestVersion>(),
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
      200: c.type<OrganizationWithProjectsCount[]>()
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
      200: c.type<Organization>(),
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
      200: c.type<Organization>(),
      403: z.object({ message: z.string() }),
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
      201: c.type<Organization>(),
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
