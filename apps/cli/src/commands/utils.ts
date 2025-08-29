import { existsSync, readdirSync, statSync } from "fs";
import { resolve, dirname, normalize, join } from 'path';
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

export class ExpiryFromNow {
  private expiryDate: Date;

  constructor(textFormat: string) {
    if (!this.isValidDurationFormat(textFormat)) {
      throw new Error('Invalid duration format. Expected format: [0-9]+(ms|s|m|h|d|w|y) e.g. "5m", "1h30m", "90d"');
    }

    const ms = this.parseDuration(textFormat);
    this.expiryDate = new Date(Date.now() + ms);
  }

  private isValidDurationFormat(text: string): boolean {
    return /^(\d+[mshdwy])+$/i.test(text);
  }

  private parseDuration(text: string): number {
    const units: { [key: string]: number } = {
      'ms': 1,
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'y': 365 * 24 * 60 * 60 * 1000
    };

    let totalMs = 0;
    const matches = text.matchAll(/(\d+)([mshdwy])/gi);
    
    for (const match of matches) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      totalMs += value * units[unit];
    }

    return totalMs;
  }

  public toDate(): Date {
    return this.expiryDate;
  }
}

/**
 * Reads directory contents two levels deep with proper path formatting
 */
function readDirectoryTwoLevelsDeep(directoryPath: string, isAbsolute: boolean, basePrefix: string = ''): string[] {
  const allPaths: string[] = [];
  
  try {
    const contents = readdirSync(directoryPath);
    
    for (const item of contents) {
      const itemPath = join(directoryPath, item);
      const itemIsDir = statSync(itemPath).isDirectory();
      
      // Add the item itself
      const formattedPath = isAbsolute ? itemPath : `${basePrefix}${item}`;
      allPaths.push(itemIsDir ? `${formattedPath}/` : formattedPath);
      
      // If it's a directory, add its contents too
      if (itemIsDir) {
        try {
          const subContents = readdirSync(itemPath);
          for (const subItem of subContents) {
            const subItemPath = join(itemPath, subItem);
            const subItemIsDir = statSync(subItemPath).isDirectory();
            
            const subFormattedPath = isAbsolute ? subItemPath : `${basePrefix}${item}/${subItem}`;
            allPaths.push(subItemIsDir ? `${subFormattedPath}/` : subFormattedPath);
          }
        } catch (error) {
          // Skip if can't read subdirectory
        }
      }
    }
  } catch (error) {
    // Return empty array on error
  }
  
  return allPaths;
}

/**
 * Takes a partial path input, finds the last complete directory, and lists its contents
 * @param input - The partial path input (e.g., "/home/user/wor")
 * @returns Array of directory contents as strings
 */
export async function getPathCompletions(input: string): Promise<string[]> {
  try {
    // If input is empty, return cwd contents with ./ prefix
    if (input === "") {
      return readDirectoryTwoLevelsDeep(process.cwd(), false, './');
    }

    // Check if path is absolute using resolve === normalize trick
    const isAbsolute = resolve(input) === normalize(input);
    
    // Get the directory to list
    const resolvedPath = resolve(input);
    const directoryToList = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory() 
      ? resolvedPath 
      : dirname(resolvedPath);
    
    // Check if directory exists
    if (!existsSync(directoryToList)) {
      return [];
    }
    
    if (isAbsolute) {
      return readDirectoryTwoLevelsDeep(directoryToList, true);
    } else {
      // Return relative paths - figure out the correct prefix
      const inputIsDir = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory();
      const baseDir = inputIsDir ? input : dirname(input);
      
      let prefix: string;
      if (baseDir === '.' || baseDir === '') {
        prefix = './';
      } else {
        prefix = `./${baseDir}/`;
      }
      
      return readDirectoryTwoLevelsDeep(directoryToList, false, prefix);
    }
  } catch (error) {
    // Return empty array on any error
    return [];
  }
}