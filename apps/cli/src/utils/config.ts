import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { getConfigDirectory } from './directories';

export const DEFAULT_INSTANCE_URL = 'https://api.envie.cloud';

class ZodConf<T> {
  private schema: z.ZodSchema<T>;
  private filename: string;
  private directory: string;
  private configPath: string;
  private content: T | null;

  constructor(
    schema: z.ZodSchema<T>,
    filename: string,
    directory: string,
  ) {
    this.schema = schema;
    this.filename = filename;
    this.directory = directory;
    this.configPath = path.join(this.directory, this.filename);
    this.content = null;
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  private readConfig(): T | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      if (!this.content) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.content = this.schema.parse(JSON.parse(content));
      }
      return this.content;
    } catch (error) {
      throw new Error(`Failed to read config file ${this.configPath}: ${error}`);
    }
  }

  private writeConfig(config: Partial<T>): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  get<K extends keyof T>(key: K): T[K] | null {
    const config = this.readConfig();
    if (!config) {
      return null;
    }
    const value = config[key];
    return value;
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    let config = this.readConfig() || {} as T;
    config[key] = value;
    this.writeConfig(config);
  }
}

// Zod schemas
const WorkspaceConfigSchema = z.object({
  organizationName: z.string(),
  projectName: z.string(),
  instanceUrl: z.string().optional()
});

const EnvieConfigSchema = z.object({
  keypairPath: z.string().optional(),
  instanceUrl: z.string().optional(),
  allowedInstances: z.array(z.object({
    url: z.string(),
    useDefaultKeypair: z.boolean().optional(),
    keypairPath: z.string().optional()
  })).optional(),
});

type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
type EnvieConfig = z.infer<typeof EnvieConfigSchema>;

const config = new ZodConf<EnvieConfig>(
  EnvieConfigSchema,
  'config.json',
  getConfigDirectory()
);

const findFileDirectoryInWorkspace = (filename: string): string => {
  let currentDir = process.cwd();
  
  // First, check if we're in a git repository
  const findGitRoot = (dir: string): string | null => {
    while (dir !== path.dirname(dir)) { // While not at filesystem root
      if (fs.existsSync(path.join(dir, '.git'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return null;
  };

  const gitRoot = findGitRoot(currentDir);
  if (!gitRoot) {
    // Not in a git repo, just use current directory
    return currentDir;
  }

  // Search from current directory up to git root for envierc.json
  while (currentDir !== path.dirname(gitRoot)) { // Don't go above git root
    if (fs.existsSync(path.join(currentDir, filename))) {
      return currentDir;
    }
    if (currentDir === gitRoot) {
      break; // We've reached git root
    }
    currentDir = path.dirname(currentDir);
  }

  // If not found, return git root as fallback
  return gitRoot;
};

const workspaceConfig = new ZodConf<WorkspaceConfig>(
  WorkspaceConfigSchema,
  'envierc.json',
  findFileDirectoryInWorkspace('envierc.json')
);

export function getKeypairPath(): string | null {
  if (process.env.ENVIE_KEYPAIR_PATH) {
    return process.env.ENVIE_KEYPAIR_PATH;
  }
  const configKeypairPath = config.get('keypairPath') ?? null;
  const instance = getInstanceUrl();

  // Check what keypair to use for the instance if it's not the default instance
  if (instance !== config.get('instanceUrl')) {
    const allowedInstances = config.get('allowedInstances') ?? [];
    const instanceConfig = allowedInstances.find(i => i.url === instance);
    if (instanceConfig?.useDefaultKeypair) {
      return configKeypairPath;
    }
    if (instanceConfig?.keypairPath) {
      return instanceConfig.keypairPath;
    }

    throw new Error(`Please specify which keypair to use for instance ${instance} in the "allowedInstances" section of your config file`);
  }
  return configKeypairPath;
}

export function setKeypairPath(path: string): void {
  config.set('keypairPath', path);
}

function validateInstanceUrl(instanceUrl?: string | null ): string | null {
  if (instanceUrl) {
    const allowedInstances = [
      ...(config.get('allowedInstances') ?? []),
      ...(config.get('instanceUrl') ?? []),
      DEFAULT_INSTANCE_URL
    ];
    if (!allowedInstances.includes(instanceUrl)) {
      throw new Error(`Unknown instance URL ${instanceUrl}. To allow it, add it to the "allowedInstances" section of your config file`);
    }
  }
  return instanceUrl ?? null;
}

export function getInstanceUrl(): string {
  return validateInstanceUrl(process.env.ENVIE_INSTANCE_URL)
    ?? validateInstanceUrl(workspaceConfig.get('instanceUrl'))
    ?? config.get('instanceUrl')
    ?? DEFAULT_INSTANCE_URL;
}

export function setInstanceUrl(url: string): void {
  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid instance URL ${url}. Please use a valid URL`);
  }
  config.set('instanceUrl', url);
}

export function getWorkspaceProjectPath(): string | null {
  const organizationName = workspaceConfig.get('organizationName');
  const projectName = workspaceConfig.get('projectName');
  if (!organizationName || !projectName) {
    return null;  
  }
  return organizationName + ':' + projectName;
}

export function getWorkspaceOrganizationName(): string | null {
  return workspaceConfig.get('organizationName');
}

export function getDotfileEnvironment(): string | null {
  const directory = findFileDirectoryInWorkspace('.envie');
  const file = path.join(directory, '.envie');
  if (!fs.existsSync(file)) {
    return null;
  }
  // Read file and return it's content as a string
  const content = fs.readFileSync(file, 'utf-8');
  return content.trim();
}