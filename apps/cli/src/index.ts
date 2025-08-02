#!/usr/bin/env node

import { program } from 'commander';
import { loginCommand } from './commands/login';
import { configCommand } from './commands/config';
import { organizationCommand } from './commands/organization';
import { projectCommand } from './commands/project';
import { environmentCommand } from './commands/environment';
import { loadCommand } from './commands/load';
import { setCommand, unsetCommand } from './commands/set';
import { accessTokenCommand } from './commands/access-tokens';

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')


  // Add commands
  program.addCommand(loginCommand);
  program.addCommand(loadCommand);
  program.addCommand(setCommand);
  program.addCommand(unsetCommand);
  program.addCommand(environmentCommand);
  program.addCommand(projectCommand);
  program.addCommand(organizationCommand);
  program.addCommand(configCommand);
  program.addCommand(accessTokenCommand);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 