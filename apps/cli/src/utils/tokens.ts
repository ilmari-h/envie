import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface TokenStore {
  [instanceUrl: string]: string;
}

function getTokensPath(): string {
  const platform = process.platform;
  let baseDir: string;

  switch (platform) {
    case 'win32':
      // Windows: %LOCALAPPDATA%
      baseDir = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
      break;
    case 'darwin':
      // macOS: ~/Library/Application Support
      baseDir = join(homedir(), 'Library', 'Application Support');
      break;
    default:
      // Linux and others: ~/.local/share
      baseDir = join(homedir(), '.local', 'share');
      break;
  }

  return join(baseDir, 'envie', 'tokens.json');
}

function ensureTokensDir(): void {
  const tokensPath = getTokensPath();
  const tokensDir = dirname(tokensPath);
  
  if (!existsSync(tokensDir)) {
    mkdirSync(tokensDir, { recursive: true });
  }
}

export function getToken(instanceUrl: string): string | undefined {
  const tokensPath = getTokensPath();
  
  if (!existsSync(tokensPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(tokensPath, 'utf-8');
    const tokens: TokenStore = JSON.parse(content);
    return tokens[instanceUrl];
  } catch (error) {
    console.warn('Failed to read tokens file:', error);
    return undefined;
  }
}

export function saveToken(instanceUrl: string, token: string): void {
  const tokensPath = getTokensPath();
  ensureTokensDir();

  let tokens: TokenStore = {};
  
  if (existsSync(tokensPath)) {
    try {
      const content = readFileSync(tokensPath, 'utf-8');
      tokens = JSON.parse(content);
    } catch (error) {
      console.warn('Failed to read existing tokens, creating new file');
      tokens = {};
    }
  }

  tokens[instanceUrl] = token;

  try {
    writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch (error) {
    throw new Error(`Failed to save token: ${error}`);
  }
}

export function removeToken(instanceUrl: string): void {
  const tokensPath = getTokensPath();
  
  if (!existsSync(tokensPath)) {
    return;
  }

  try {
    const content = readFileSync(tokensPath, 'utf-8');
    const tokens: TokenStore = JSON.parse(content);
    
    delete tokens[instanceUrl];
    
    writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch (error) {
    console.warn('Failed to remove token:', error);
  }
}