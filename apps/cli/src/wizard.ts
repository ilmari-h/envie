import { getAppDataDirectory, getConfigDirectory } from "./utils/directories";
import chalk from 'chalk';
import fs from 'fs';
import { confirm } from "./ui/confirm";
import { textInput } from "./ui/text-input";
import omelette from "omelette";
import path from "path";
import { DEFAULT_INSTANCE_URL, setInstanceUrl, setKeypairPath } from "./utils/config";

const completion = omelette(`envie`);


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

  const question1 = `${chalk.bold('1. Do you want to enable TAB autocomplete?')}
This will append the following line to your shell init file (.bashrc or .zshrc).

  . <(envie --completion)

You can also add this manually later by running \`envie --setup\`
${chalk.bold('Enable TAB autocomplete?')}`;

  const question2 = `${chalk.bold('2. Keypair path')}
Envie uses public key encryption to secure your environment data.
Enter the path to your Ed25519 keypair file.
If you do not have one, you can generate one with the following command:

  \`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519\`

${chalk.bold('Keypair path?')}`;

  const question3 = `${chalk.bold('3. Instance URL')}
Choose your default instance to connect to.

${chalk.bold('Default instance URL?')}`;

  const useAutocomplete = await confirm({
    prompt: question1,
    defaultNo: false
  })

  console.log("TAB autocomplete ", chalk.bold(useAutocomplete ? "ON" : "OFF"))
  console.log("\n")

  const keypairPath = await textInput({
    prompt:question2,
    default: "~/.ssh/id_ed25519"
  })
  const normalizedKeypairPath = path.normalize(resolveHome(keypairPath))
  setKeypairPath(normalizedKeypairPath)
  console.log("Keypair set to: ", chalk.bold(normalizedKeypairPath))


  const instanceUrl = await textInput({
    prompt:question3,
    default: DEFAULT_INSTANCE_URL
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