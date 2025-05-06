import { initContract } from '@ts-rest/core';
import { z } from 'zod';

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
      200: z.array(EnvironmentSchema.extend({
        project: ProjectSchema
      }))
    },
    summary: 'Get all environments for current user'
  },
  
  getEnvironment: {
    method: 'GET',
    path: '/environments/:id',
    pathParams: z.object({
      id: z.number()
    }),
    responses: {
      200: EnvironmentSchema.extend({
        project: ProjectSchema
      }),
      404: z.object({ message: z.string() })
    },
    summary: 'Get environment by ID'
  }
});

export type Environment = z.infer<typeof EnvironmentSchema>; 