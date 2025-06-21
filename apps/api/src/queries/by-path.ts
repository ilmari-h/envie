import { db, Organization, Project, Schema } from '@repo/db';
import { eq, and, or, SQL } from 'drizzle-orm';
import { isValidUUID } from '../crypto/crypto';

export interface UserAccessControlRules {
  addMembers?: boolean;
  createEnvironments?: boolean;
  createProjects?: boolean;
  editProject?: boolean;

  editEnvironment?: boolean;
}

const isValidPath = (path: string, length: number) => {
  const parts = path.split(':');
  return parts.length === length;
}

export async function getOrganization(pathOrId: string, userId: string, accessControlRules?: Omit<UserAccessControlRules, 'editEnvironment'>) {

  if(!isValidPath(pathOrId, 1) && !isValidUUID(pathOrId)) {
    throw new Error('Invalid organization path');
  }

  const whereStatements: (SQL | undefined)[] = !isValidPath(pathOrId, 1) && isValidUUID(pathOrId)
    ? [eq(Schema.organizations.id, pathOrId)]
    : [];
  
  // Resolve path
  if(whereStatements.length === 0) {
    // Path must not contain ':'
    if(pathOrId.includes(':')) {
      throw new Error('Invalid organization path');
    }
    if (pathOrId === 'personal') {
      whereStatements.push(
        eq(Schema.organizations.createdById, userId),
        eq(Schema.organizations.hobby, true)
      );
    } else {
      whereStatements.push(eq(Schema.organizations.name, pathOrId));
    }
  }

  const organization = await db.query.organizations.findFirst({
    where: and(...whereStatements),
    with: {
      roles: {
        where: eq(Schema.organizationRoles.userId, userId)
      }
    }
    });

  const userRole = organization?.roles.find(role => {
    if(accessControlRules?.addMembers && !role.canAddMembers) {
      return false;
    }
    if(accessControlRules?.createEnvironments && !role.canCreateEnvironments) {
      return false;
    }
    if(accessControlRules?.createProjects && !role.canCreateProjects) {
      return false;
    }
    if(accessControlRules?.editProject && !role.canEditProject) {
      return false;
    }
    return true;
  })

  if(!userRole) {
    throw new Error('Missing organization access rights');
  }

  return organization;
}

export async function getProjectByPath(pathOrId: string, userId: string, accessControlRules?: Omit<UserAccessControlRules, 'editEnvironment'>): Promise<[Organization, Project]> {

  if(!isValidPath(pathOrId, 2) && !isValidUUID(pathOrId)) {
      throw new Error('Invalid project path');
  }

  const whereStatements: (SQL | undefined)[] = !isValidPath(pathOrId, 2) && isValidUUID(pathOrId)
    ? [eq(Schema.projects.id, pathOrId)]
    : [];


  // Resolve path
  if(whereStatements.length === 0) {

    // Path must contain two parts separated by ':'
    const parts = pathOrId.split(':');
    const [organizationPart, projectPart] = parts as [string, string];
    const projectOrganization = await getOrganization(organizationPart, userId, accessControlRules);
    if(!projectOrganization) {
      throw new Error('Invalid organization path');
    }
    whereStatements.push(
      eq(Schema.projects.organizationId, projectOrganization.id),
      or(
        eq(Schema.projects.name, projectPart),
        eq(Schema.projects.id, projectPart)
      )
    );
  }

  const project = await db.query.projects.findFirst({
    where: and(...whereStatements),
    with: {
      organization: true
    }
  });
  if(!project) {
    throw new Error('Project not found');
  }
  return [project.organization, project]
}

export async function getEnvironmentByPath(
  pathOrId: string,
  userId: string,
  userAccessControlRules?: UserAccessControlRules
) {
  if(!isValidPath(pathOrId, 3) && !isValidUUID(pathOrId)) {
    throw new Error('Invalid environment path');
  }

  const whereStatements: (SQL | undefined)[] = !isValidPath(pathOrId, 3) && isValidUUID(pathOrId)
    ? [eq(Schema.environments.id, pathOrId)]
    : [];

  let organization: Organization | undefined;
  let project: Project | undefined;
  
  // Resolve path
  if(whereStatements.length === 0) {
    // Path must contain three parts separated by ':'
    const parts = pathOrId.split(':');
    const [organizationPart, projectPart, environmentPart] = parts as [string, string, string];

    [organization, project] = await getProjectByPath(`${organizationPart}:${projectPart}`, userId);
    if(!organization || !project) {
      throw new Error('Invalid project path');
    }
    whereStatements.push(
      eq(Schema.environments.projectId, project.id),
      or(
        eq(Schema.environments.name, environmentPart),
        eq(Schema.environments.id, environmentPart)
      )
    );
  }

  const environment = await db.query.environments.findFirst({
    where: and(...whereStatements),
    with: {
      access: {
        where: eq(Schema.environmentAccess.userId, userId)
      },
      project: {
        with: {
          organization: true
        }
      }
    }
  });

  const userAccess = environment?.access.find(access => {
    if(userAccessControlRules?.editEnvironment && !access.write) {
      return false;
    }
    return true;
  });
  if(!userAccess) {
    throw new Error('Missing environment access rights');
  }

  if(!environment) {
    throw new Error('Environment not found');
  }
  return [environment.project.organization, environment.project, environment];
}

// TODO: query all environments for a project