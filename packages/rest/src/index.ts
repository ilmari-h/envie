import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Environment } from '@repo/db';

const c = initContract();

const health = c.router({
  getHealth: {
    method: 'GET',
    path: '/health',
    responses: {
      200: c.type<{ status: 'ok' }>()
    }
  }
});

const environments = c.router({
  getEnvironments: {
    method: 'GET',
    path: '/environments',
    responses: {
      200: c.type<Environment[]>()
    },
    summary: 'Get all environments for current user'
  },
  
  getEnvironment: {
    method: 'GET',
    path: '/environments/:id',
    pathParams: z.object({
      id: z.string()
    }),
    responses: {
      200: c.type<Environment>(),
      404: z.object({ message: z.string() })
    },
    summary: 'Get environment by ID'
  },

  createEnvironment: {
    method: 'POST',
    path: '/environments',
    body: z.object({
      name: z.string(),
      projectId: z.string(),
      content: z.string(),
      allowedUserIds: z.array(z.string()).optional()
    }),
    responses: {
      201: c.type<Environment>(),
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
      200: c.type<Environment>(),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update environment content'
  },

  updateEnvironmentAccess: {
    method: 'PUT',
    path: '/environments/:id/access',
    pathParams: z.object({
      id: z.string()
    }),
    body: z.object({
      userIds: z.array(z.string())
    }),
    responses: {
      200: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() })
    },
    summary: 'Update environment access control'
  }
});

export const contract = c.router({
  health,
  environments
});
