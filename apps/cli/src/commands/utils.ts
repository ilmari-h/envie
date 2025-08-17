import { getWorkspaceProjectPath } from "../utils/config";

export class EnvironmentPath {
  organizationName: string;
  projectName: string;
  environmentName: string;

  constructor(path: string) {
    const workspaceProjectPath = getWorkspaceProjectPath();
    let pathParts = path.split(':');
    
    // User has provided just the environment name, so we get rest of the path from the workspace config
    if (workspaceProjectPath && pathParts.length === 1) {
      pathParts = workspaceProjectPath.split(':').concat(pathParts);
    }

    // Validate path parts
    if (pathParts.length !== 3) {
      throw new Error('Invalid environment path, expected format "organization-name:project-name:env-name"');
    }

    const [organizationName, projectName, environmentName] = pathParts;
    if (!organizationName.trim() || !projectName.trim() || !environmentName.trim()) {
      throw new Error('All parts (organization, project, environment) must be non-empty');
    }

    this.organizationName = organizationName;
    this.projectName = projectName;
    this.environmentName = environmentName;
  }

  public toString(): string {
    return `${this.organizationName}:${this.projectName}:${this.environmentName}`;
  }

  public get projectPath(): ProjectPath {
    return new ProjectPath(`${this.organizationName}:${this.projectName}`);
  }
}

export class ProjectPath {
  organizationName: string;
  projectName: string;

  constructor(path: string) {
    const parts = path.split(':');
    if (parts.length !== 2) {
      throw new Error('Project path must be in format "organization-name:project-name"');
    }
    const [organizationName, projectName] = parts;
    if (!organizationName.trim() || !projectName.trim()) {
      throw new Error('All parts (organization, project) must be non-empty');
    }
    this.organizationName = organizationName;
    this.projectName = projectName;
  }

  public toString(): string {
    return `${this.organizationName}:${this.projectName}`;
  }
}