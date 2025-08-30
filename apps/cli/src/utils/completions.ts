import { readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve, normalize } from "path";
import { createTsrClient } from "./tsr-client";
import { getInstanceUrl } from "./config";

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
export async function filepathCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
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

export async function getOrganizationCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
  try {
    const client = createTsrClient(getInstanceUrl());
    const response = await client.organizations.getOrganizations({});
    if (response.status !== 200) {
      return [];
    }
    return response.body.map(organization => organization.name);
  } catch {
    return [];
  }
}

export async function projectCompletionsWithTrailingColon({input, before}: {input: string, before: string}): Promise<string[]> {
  const projects = await projectCompletions({input, before});
  return projects.map(project => `${project}:`);
}

export async function projectCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
    try {
      const client = createTsrClient(getInstanceUrl());
      const response = await client.projects.getProjects({});
      if (response.status !== 200) {
        return [];
      }
      return response.body.map(project => `${project.organization.name}:${project.name}`);
    } catch {
      return [];
    }
}

export async function environmentCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
  try {
    const client = createTsrClient(getInstanceUrl());
    const response = await client.environments.getEnvironments({});
    if (response.status !== 200) {
      return [];
    }
    return response.body.map(environment => `${environment.project.organization.name}:${environment.project.name}:${environment.name}`);
  } catch {
    return [];
  }
}

export async function userCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
  try {
    const client = createTsrClient(getInstanceUrl());

    // Get all users that share an organization with the current user
    const response = await client.user.listUsers({});
    if (response.status !== 200) {
      return [];
    }
    return response.body.map(user => user.name);
  } catch {
    return [];
  }
}

export async function tokenCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
  try {
    const client = createTsrClient(getInstanceUrl());
    const response = await client.accessTokens.getAccessTokens({});
    if (response.status !== 200) {
      return [];
    }
    return response.body.map(token => token.name);
  } catch {
    return [];
  }
}

export async function userAndTokenCompletions({input, before}: {input: string, before: string}): Promise<string[]> {
  try {
    const users = await userCompletions({input, before});
    const tokens = await tokenCompletions({input, before});
    return [...users, ...tokens];
  } catch {
    return [];
  }
}