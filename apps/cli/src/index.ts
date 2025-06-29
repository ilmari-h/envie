#!/usr/bin/env node

import { program } from 'commander';
import { loginCommand } from './commands/login.js';
import { configCommand } from './commands/config.js';

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')
    .version('0.0.1')
    .option('--instance-url <url>', 'URL of the server to connect to');

  // Add commands
  program.addCommand(configCommand);
  program.addCommand(loginCommand);

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 