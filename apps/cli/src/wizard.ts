import { getAppDataDirectory, getConfigDirectory } from "./utils/directories";
import chalk from 'chalk';
import fs from 'fs';
import { confirm } from "./ui/confirm";
import { textInput } from "./ui/text-input";
import omelette from "omelette";
import path from "path";
import { DEFAULT_INSTANCE_URL, setInstanceUrl, setKeypairPath } from "./utils/config";
import { execSync } from 'child_process';

const completion = omelette(`envie`);

function checkSshKeygenExists(): boolean {
  try {
    execSync('which ssh-keygen', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function promptForKeypairPath(): Promise<string> {
  const question = `${chalk.bold('\nEnter the path to your Ed25519 keypair file.')}
If you do not have one, you can generate one with the following command:

  ${chalk.cyan('ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""')}

${chalk.bold('Keypair path?')}`;

  const path = await textInput({
    prompt: question,
    default: "~/.ssh/id_ed25519",
    prefill: true
  });
  
  return resolveHome(path);
}

export function checkIfFirstTime():boolean {
  const configDirectory = getConfigDirectory()
  const configFile = path.join(configDirectory, 'config.json')
  return !fs.existsSync(configFile)
}
function resolveHome(filepath: string) {
    const home = process.env.HOME;
    if(!home) {
        return filepath;
    }
    if (filepath[0] === '~') {
        return path.join(home, filepath.slice(1));
    }
    return filepath;
}
export async function wizard() {
  // Start wizard
  console.log(chalk.green.bold('Welcome to the Envie setup wizard 🪄'))
  console.log('Looks like this is your first time running Envie on this machine.')
  console.log('This wizard will help you get set up.\n')
  console.log('You can also run the wizard later by running:\n')
  console.log("  envie --wizard\n")

  const question1 = `${chalk.bold('1. Do you want to enable TAB autocomplete?')}
This will append a line to your shell init file (.bashrc or .zshrc).

${chalk.bold('Enable TAB autocomplete?')}`;

  const question3 = `${chalk.bold('\n3. Instance URL')}
Choose your default instance to connect to.

${chalk.bold('Default instance URL?')}`;

  const useAutocomplete = await confirm({
    prompt: question1,
    defaultNo: false
  })

  console.log("TAB autocomplete ", chalk.bold(useAutocomplete ? "ON" : "OFF"))

  // Step 2: Keypair handling
  const defaultKeypairPath = "~/.ssh/id_envie_ed25519";
  let keypairPath: string;

  if (checkSshKeygenExists()) {
    const generateKeypairPrompt = `${chalk.bold('\n2. Keypair path')}
Generating new Ed25519 keypair in

${chalk.cyan(defaultKeypairPath)}

${chalk.bold('Continue? (Decline if you want to specify your own keypair path)')}`;

    const shouldGenerateKeypair = await confirm({
      prompt: generateKeypairPrompt,
      defaultNo: false
    });

    if (shouldGenerateKeypair) {
      const resolvedPath = resolveHome(defaultKeypairPath);
      
      // Ensure the .ssh directory exists
      const sshDir = path.dirname(resolvedPath);
      if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true });
      }

      try {
        execSync(`ssh-keygen -t ed25519 -f "${resolvedPath}" -N "" -q`, { stdio: 'inherit' });
        keypairPath = resolvedPath;
      } catch (error) {
        console.error(chalk.red("Failed to generate keypair."));
        process.exit(1);
      }
    } else {
      keypairPath = await promptForKeypairPath();
    }
  } else {
    console.log(chalk.yellow("\nssh-keygen not found"));
    process.exit(1);
  }

  const normalizedKeypairPath = path.normalize(keypairPath);
  setKeypairPath(normalizedKeypairPath);
  console.log("Keypair set to:", chalk.bold(normalizedKeypairPath));


  const instanceUrl = await textInput({
    prompt: question3,
    default: DEFAULT_INSTANCE_URL,
    prefill: true
  })
  setInstanceUrl(instanceUrl)
  console.log("Instance URL set to: ", chalk.bold(instanceUrl))

  console.log("\nSetup complete.")
  console.log("You can now login with:\n")
  console.log("  envie login\n")

  if(useAutocomplete) {
    completion.setupShellInitFile();
  }
}