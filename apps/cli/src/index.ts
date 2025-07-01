#!/usr/bin/env node

import { program } from 'commander';
import { loginCommand } from './commands/login';
import { configCommand } from './commands/config';
import { organizationCommand } from './commands/organization';
import { projectCommand } from './commands/project';
import { environmentCommand } from './commands/environment';
import { loadCommand } from './commands/load';

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')
    .version('0.0.1')


  // Add commands
  program.addCommand(configCommand);
  program.addCommand(loginCommand);
  program.addCommand(organizationCommand);
  program.addCommand(projectCommand);
  program.addCommand(environmentCommand);
  program.addCommand(loadCommand);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 