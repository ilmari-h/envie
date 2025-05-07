import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { Environment } from '@repo/db';

const c = initContract();

const EnvironmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  projectId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
});

const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  organizationId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const contract = c.router({
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
