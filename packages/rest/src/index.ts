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
  }
});

export const contract = c.router({
  health,
  environments
});
