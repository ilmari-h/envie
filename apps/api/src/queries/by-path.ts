import { db, Environment, EnvironmentAccess, environments, Organization, OrganizationRole, Project, Schema } from '@repo/db';
import { eq, and, or, SQL } from 'drizzle-orm';
import { isUserRequester } from '../types/cast';

export const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
export interface OperationScope {
  // One or the other
  requester: Express.Requester;

  addMembers?: boolean;
  createEnvironments?: boolean;
  createProjects?: boolean;
  editProject?: boolean;
  editOrganization?: boolean;

  editEnvironment?: boolean;
}

const isValidPath = (path: string, length: number) => {
  const parts = path.split(':');
  return parts.length === length;
}

export interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
}

export async function getOrganization(pathOrId: string, scope: Omit<OperationScope, 'editEnvironment'>): Promise<OrganizationWithRole> {
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

    whereStatements.push(eq(Schema.organizations.name, pathOrId));
  }

  const organization = await db.query.organizations.findFirst({
    where: and(...whereStatements),
    with: {
      roles: {
        where: isUserRequester(scope.requester)
          ? eq(Schema.organizationRoles.userId, scope.requester.userId)
          : eq(Schema.organizationRoles.accessTokenId, scope.requester.apiKeyId)
      }
    }
    });

  if(!organization) {
    throw new Error('Organization not found');
  }

  const userRole = organization?.roles.find(role => {
    if(scope?.addMembers && !role.canAddMembers) {
      return false;
    }
    if(scope?.createEnvironments && !role.canCreateEnvironments) {
      return false;
    }
    if(scope?.createProjects && !role.canCreateProjects) {
      return false;
    }
    if(scope?.editProject && !role.canEditProject) {
      return false;
    }
    if(scope?.editOrganization && !role.canEditOrganization) {
      return false;
    }
    return true;
  })

  if(!userRole) {
    throw new Error('Missing organization access rights');
  }
  return {
    ...organization,
    role: userRole
  };
}

export async function getProjectByPath(pathOrId: string, scope: Omit<OperationScope, 'editEnvironment'>): Promise<[OrganizationWithRole, Project]> {

  if(!isValidPath(pathOrId, 2) && !isValidUUID(pathOrId)) {
      throw new Error('Invalid project path');
  }

  const whereStatements: (SQL | undefined)[] = !isValidPath(pathOrId, 2) && isValidUUID(pathOrId)
    ? [eq(Schema.projects.id, pathOrId)]
    : [];


  // Resolve path
  let organization: OrganizationWithRole | undefined;
  if(whereStatements.length === 0) {

    // Path must contain two parts separated by ':'
    const parts = pathOrId.split(':');
    const [organizationPart, projectPart] = parts as [string, string];
    organization = await getOrganization(organizationPart, scope);
    if(!organization) {
      throw new Error('Invalid organization path');
    }
    whereStatements.push(
      eq(Schema.projects.organizationId, organization.id),
      eq(Schema.projects.name, projectPart)
    );
  }

  const project = await db.query.projects.findFirst({
    where: and(...whereStatements),
  });
  if(!project) {
    throw new Error('Project not found');
  }

  // Get organization with scope check
  if(!organization) {
    organization = await getOrganization(project.organizationId, scope);
  }
  return [organization, { ...project, organization }]
}

export async function getEnvironmentByPath(
  pathOrId: string,
  scope: OperationScope
): Promise<[OrganizationWithRole, Project, Environment & { access: EnvironmentAccess }]> {
  if(!isValidPath(pathOrId, 3) && !isValidUUID(pathOrId)) {
    throw new Error('Invalid environment path');
  }

  const whereStatements: (SQL | undefined)[] = !isValidPath(pathOrId, 3) && isValidUUID(pathOrId)
    ? [eq(Schema.environments.id, pathOrId)]
    : [];

  let organization: OrganizationWithRole | undefined;
  let project: Project | undefined;
  
  // Resolve path
  if(whereStatements.length === 0) {
    // Path must contain three parts separated by ':'
    const parts = pathOrId.split(':');
    const [organizationPart, projectPart, environmentPart] = parts as [string, string, string];

    [organization, project] = await getProjectByPath(`${organizationPart}:${projectPart}`, scope);
    if(!organization || !project) {
      throw new Error('Invalid project path');
    }
    whereStatements.push(
      eq(Schema.environments.projectId, project.id),
      eq(Schema.environments.name, environmentPart)
    );
  }

  const environment = await db.query.environments.findFirst({
    where: and(...whereStatements),
    with: {
      project: true,
      access: {
        where: isUserRequester(scope.requester)
          ? eq(Schema.environmentAccess.userId, scope.requester.userId)
          : eq(Schema.environmentAccess.accessTokenId, scope.requester.apiKeyId)
      },
    }
  });

  const userAccess = environment?.access.find(access => {
    if(scope?.editEnvironment && !access.write) {
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
  if(!organization || !project) {
    [organization, project] = await getProjectByPath(environment.projectId, scope);
  }
  return [organization, project, { ...environment, access: userAccess, project: project }];
}

export async function getProjectEnvironments(
  projectPathOrId: string,
  scope: OperationScope
): Promise<(Environment & { access: EnvironmentAccess })[]> {
  const [organization, project] = await getProjectByPath(projectPathOrId, scope);

  const environments = await db.query.environments.findMany({
    where: eq(Schema.environments.projectId, project.id),
    with: {
      project: true,
      access: {
        where: isUserRequester(scope.requester)
          ? eq(Schema.environmentAccess.userId, scope.requester.userId)
          : eq(Schema.environmentAccess.accessTokenId, scope.requester.apiKeyId)
      },
    }
  });

  // Filter environments based on scope
  const filteredEnvironments = environments.filter(environment => {
    if(scope?.editEnvironment && !environment.access.find(access => access.write)) {
      return false;
    }
    return true;
  });

  return filteredEnvironments.map(environment => ({
    ...environment,
    project: {
      ...project,
      organization: organization
    },
    access: environment.access[0]!
  }));
}

export async function getOrganizationEnvironments(
  organizationPathOrId: string,
  scope: OperationScope
): Promise<(Environment & { access: EnvironmentAccess })[]> {
  const organization = await getOrganization(organizationPathOrId, scope);

  const projects = await db.query.projects.findMany({
    where: eq(Schema.projects.organizationId, organization.id),
  });

  const environmentsPromises = projects.map(project => 
    getProjectEnvironments(project.id, scope)
      .then(environments => environments.map(env => ({ ...env, project })))
  );

  const allEnvironments = await Promise.all(environmentsPromises);
  return allEnvironments.flat().map(environment => ({
    ...environment,
    project: {
      ...environment.project,
      organization: organization
    }
  }));
}