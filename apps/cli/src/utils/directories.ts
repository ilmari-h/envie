import { homedir } from "os";
import { join } from "path";
import * as os from 'os';

export const getAppDataDirectory = () => {
  const platform = os.platform();
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

  return join(baseDir, 'envie');
}
export const getConfigDirectory = (): string => {
  if (process.env.ENVIE_CONFIG_DIRECTORY) {
    return process.env.ENVIE_CONFIG_DIRECTORY;
  }

  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      // Windows: Use APPDATA or fallback to %USERPROFILE%\AppData\Roaming
      return process.env.APPDATA || join(homeDir, 'AppData', 'Roaming', 'envie');
    
    case 'darwin':
      // macOS: Use ~/Library/Application Support
      return join(homeDir, 'Library', 'Application Support', 'envie');
    
    default:
      // Linux and others: Use XDG_CONFIG_HOME or ~/.config
      return process.env.XDG_CONFIG_HOME 
        ? join(process.env.XDG_CONFIG_HOME, 'envie')
        : join(homeDir, '.config', 'envie');
  }
};