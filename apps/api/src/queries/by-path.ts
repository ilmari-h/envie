import { db, Schema } from '@repo/db';
import { eq, and, count, exists, not, desc, inArray, or } from 'drizzle-orm';
import { isValidUUID } from '../crypto/crypto';

export async function getOrganization(pathOrId: string, userId: string) {

  // Path must not contain ':'
  if(pathOrId.includes(':')) {
    throw new Error('Invalid organization path');
  }

  // if equals 'personal', get the user's personal org
  if(pathOrId === 'personal') {
    const organization = await db.query.organizations.findFirst({
      where: and(
          eq(Schema.organizations.createdById, userId),
          eq(Schema.organizations.hobby, true)
      )
    });
    return organization;
  }

  const organization = await db.query.organizations.findFirst({
    where: or(
        eq(Schema.organizations.name, pathOrId),
        eq(Schema.organizations.id, pathOrId)
      )
    });
  return organization;
}

export async function getProjectByPath(pathOrId: string, userId: string) {
    // Path must contain two parts separated by ':'
    const parts = pathOrId.split(':');
    if(parts.length !== 2) {
      throw new Error('Invalid project path');
    }
    const [organizationPart, projectPart] = parts as [string, string];

    // if equals 'personal', get the user's personal project
    const organization = await getOrganization(organizationPart, userId);
    if(!organization) {
      throw new Error('Invalid organization path');
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(Schema.projects.organizationId, organization.id),
        or(
          eq(Schema.projects.name, projectPart),
          eq(Schema.projects.id, projectPart)
        )
      )
    });
    if(!project) {
      throw new Error('Project not found');
    }
    return [organization, project];
}

export async function getEnvironmentByPath(pathOrId: string, userId: string) {
  // Path must contain three parts separated by ':'
  const parts = pathOrId.split(':');
  if(parts.length !== 3) {
    throw new Error('Invalid environment path');
  }
  const [organizationPart, projectPart, environmentPart] = parts as [string, string, string];

  const [organization, project] = await getProjectByPath(`${organizationPart}:${projectPart}`, userId);
  if(!organization || !project) {
    throw new Error('Invalid project path');
  }

  const environment = await db.query.environments.findFirst({
    where: and(
      eq(Schema.environments.projectId, project.id),
      eq(Schema.environments.name, environmentPart)
    )
  });
  if(!environment) {
    throw new Error('Environment not found');
  }
  return [organization, project, environment];
}