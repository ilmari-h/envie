#!/usr/bin/env node

import { program } from 'commander';
import { loginCommand } from './commands/login';
import { configCommand } from './commands/config';
import { organizationCommand } from './commands/organization';
import { projectCommand } from './commands/project';
import { environmentCommand } from './commands/environment';
import { loadCommand } from './commands/load';
import { setCommand, unsetCommand } from './commands/set';
import { execCommand } from './commands/exec';
import { accessTokenCommand } from './commands/access-tokens';
import { resetKeypairCommand } from './commands/reset-keypair';

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')


  // Add commands
  program.addCommand(loginCommand);
  program.addCommand(execCommand);
  program.addCommand(loadCommand);
  program.addCommand(setCommand);
  program.addCommand(unsetCommand);
  program.addCommand(environmentCommand);
  program.addCommand(projectCommand);
  program.addCommand(organizationCommand);
  program.addCommand(configCommand);
  program.addCommand(accessTokenCommand);
  program.addCommand(resetKeypairCommand);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 