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

