import Conf, { Schema } from 'conf';

interface EnvieConfig {
  keypairPath?: string;
  instanceUrl?: string;
}

const configSchema: Schema<EnvieConfig> = {
  keypairPath: {
    type: 'string'
  },
  instanceUrl: {
    type: 'string',
    default: 'http://localhost:3001'
  }
};

export const config = new Conf<EnvieConfig>({
  projectName: 'envie',
  schema: configSchema,
  defaults: {
    instanceUrl: 'http://localhost:3001'
  },
  cwd: process.env.ENVIE_CONFIG_DIRECTORY
});

export function getKeypairPath(): string | undefined {
  return process.env.ENVIE_KEYPAIR_PATH ?? config.get('keypairPath');
}

export function setKeypairPath(path: string): void {
  config.set('keypairPath', path);
}

export function getInstanceUrl(): string {
  return process.env.ENVIE_INSTANCE_URL ?? config.get('instanceUrl', 'https://api.envie.cloud');
}

export function setInstanceUrl(url: string): void {
  config.set('instanceUrl', url);
}