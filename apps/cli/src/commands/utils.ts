export class EnvironmentPath {
  organizationName: string;
  projectName: string;
  environmentName: string;

  constructor(path: string) {
    const parts = path.split(':');
    if (parts.length !== 3) {
      throw new Error('Environment path must be in format "organization-name:project-name:env-name"');
    }
    const [organizationName, projectName, environmentName] = parts;
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