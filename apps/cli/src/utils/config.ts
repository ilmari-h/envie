import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  allowedInstances: z.array(z.string()).optional(),
});

type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
type EnvieConfig = z.infer<typeof EnvieConfigSchema>;

const getConfigDirectory = (): string => {
  if (process.env.ENVIE_CONFIG_DIRECTORY) {
    return process.env.ENVIE_CONFIG_DIRECTORY;
  }

  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      // Windows: Use APPDATA or fallback to %USERPROFILE%\AppData\Roaming
      return process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming', 'envie');
    
    case 'darwin':
      // macOS: Use ~/Library/Application Support
      return path.join(homeDir, 'Library', 'Application Support', 'envie');
    
    default:
      // Linux and others: Use XDG_CONFIG_HOME or ~/.config
      return process.env.XDG_CONFIG_HOME 
        ? path.join(process.env.XDG_CONFIG_HOME, 'envie')
        : path.join(homeDir, '.config', 'envie');
  }
};

const config = new ZodConf<EnvieConfig>(
  EnvieConfigSchema,
  'config.json',
  getConfigDirectory()
);

const findWorkspaceConfigDirectory = (): string => {
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
    if (fs.existsSync(path.join(currentDir, 'envierc.json'))) {
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
  findWorkspaceConfigDirectory()
);

export function getKeypairPath(): string | null {
  return process.env.ENVIE_KEYPAIR_PATH ?? config.get('keypairPath') ?? null;
}

export function setKeypairPath(path: string): void {
  config.set('keypairPath', path);
}

export function getInstanceUrl(): string {
  return process.env.ENVIE_INSTANCE_URL
    ?? workspaceConfig.get('instanceUrl')
    ?? config.get('instanceUrl')
    ?? 'https://api.envie.cloud';
}

export function setInstanceUrl(url: string): void {
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
