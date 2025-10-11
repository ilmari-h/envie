import path from "path";
import { getAppDataDirectory } from "./directories";
import chalk from "chalk";
import fs from "fs";

declare const __VERSION_STRING__: string;

const VERSION_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

export const getCliVersion = (): string => {
  return __VERSION_STRING__;
}

export const checkUpdateAvailable = async (): Promise<string | undefined> => {

  // Check first for when last version check was completed
  const appDataPath = getAppDataDirectory();
  const lastVersionCheckPath = path.join(appDataPath, 'last-version-check.txt');
  const lastVersionCheck = fs.existsSync(lastVersionCheckPath)
    ? fs.readFileSync(lastVersionCheckPath, 'utf-8')
    : null;


  // Check if we should check for a new version
  const lastVersionCheckDate = lastVersionCheck ? new Date(lastVersionCheck.trim()) : null;
  if (lastVersionCheckDate && lastVersionCheckDate.getTime() + VERSION_CHECK_INTERVAL > Date.now()) {
    return;
  }


  const response = await fetch('https://api.github.com/repos/ilmari-h/envie/releases/latest');
  const data: { tag_name: string } | undefined = await response.json();
  if (response.status !== 200 || !data?.tag_name) {
    // Update last check time even on error
    fs.writeFileSync(lastVersionCheckPath, new Date().toISOString());
    return;
  }
  if( data.tag_name.trim() === getCliVersion()) {
    // Update last check time when no newer version found
    fs.writeFileSync(lastVersionCheckPath, new Date().toISOString());
    return;
  }
  return data.tag_name;
}

export const doVersionCheck = async (): Promise<string | undefined> => {
  const latestVersion = await checkUpdateAvailable();
  if (!latestVersion) {
    return;
  }
  return `${chalk.yellow('New version of Envie available!')}
Please upgrade by running:

npm install -g @envie/cli@${latestVersion}`;
}