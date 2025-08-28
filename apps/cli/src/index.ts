#!/usr/bin/env node

import { program, Command } from 'commander';
import omelette from 'omelette';
import { loginCommand } from './commands/login';
import { configCommand } from './commands/config';
import { organizationCommand } from './commands/organization';
import { projectCommand } from './commands/project';
import { environmentCommand } from './commands/environment';
import { setCommand, unsetCommand } from './commands/set';
import { execCommand } from './commands/exec';
import { accessTokenCommand } from './commands/access-tokens';
import { AutocompleteCommand } from './commands/root';


async function setupProgram(program: Command, commands: AutocompleteCommand[]) {

  // Setup autocomplete tree
  const tree = commands.reduce((acc, command) => {
    acc[command.name()] = command?.getTree()[command.name()] ?? [];
    return acc;
  }, {} as { [key: string]: string[] });


  const complete = omelette("envie").tree(tree);

  complete.init();

  // Handle completion setup/cleanup
  if (process.argv.includes('--setup')) {
    complete.setupShellInitFile();
    process.exit(0);
  }

  if (process.argv.includes('--cleanup')) {
    complete.cleanupShellInitFile();
    process.exit(0);
  }

  for (const command of commands) {
    program.addCommand(command);
  }
}

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')

  await setupProgram(program, [
    loginCommand,
    execCommand,
    setCommand,
    unsetCommand,
    environmentCommand,
    projectCommand,
    organizationCommand,
    configCommand,
    accessTokenCommand,
  ]);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 