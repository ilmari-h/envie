import { getDotfileEnvironment, getWorkspaceProjectPath } from "../../utils/config";
import { ProjectPath } from "./project-path";

export class EnvironmentPath {
  organizationName: string;
  projectName: string;
  environmentName: string;
  version?: number

  constructor(path: string) {
    let normalizedPath = path;
    
    // Parse version suffix (@version) before processing path further
    const versionMatch = normalizedPath.match(/@(\d+)$/);
    if (versionMatch) {
      this.version = parseInt(versionMatch[1], 10);
      normalizedPath = normalizedPath.replace(/@\d+$/, '');
    }
    
    if (path === 'default') {
      const dotfileEnvironment = getDotfileEnvironment();
      if (!dotfileEnvironment) {
        throw new Error('Specified "default" as environment path, but no .envie file found');
      }
      normalizedPath = dotfileEnvironment;
    }

    const workspaceProjectPath = getWorkspaceProjectPath();
    let pathParts = normalizedPath.split(':');
    
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