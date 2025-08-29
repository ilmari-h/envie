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

async function startProgram(program: Command, commands: AutocompleteCommand[]) {

  const complete = omelette(`envie`);

  const autocompleteCallback = (fragment: string, {reply, before, line}: omelette.CallbackAsyncValue) => {
    const lineWithTyping = line.split(/\s+/);
    const typing = lineWithTyping[lineWithTyping.length - 1] !== ""
    const typingInput = typing ? lineWithTyping[lineWithTyping.length - 1] : null

    const lineSegments = lineWithTyping.slice(0, -1)

    // If no before, suggest first level commands
    if (lineSegments.length === 1) {
      const commandNames = commands.map(command => command.name());
      reply(Promise.resolve(commandNames));
      return
    }

    // Find the current subcommand by traversing down the command tree
    let currentCommand: AutocompleteCommand | undefined = undefined;
    let segmentIndex = 1; // Start from index 1, skip 'envie'
    
    // Find the initial command
    if (segmentIndex < lineSegments.length) {
      const commandName = lineSegments[segmentIndex];
      currentCommand = commands.find(cmd => cmd.name() === commandName);
      segmentIndex++;
    }
    
    // Traverse down the tree through subcommands
    while (currentCommand && segmentIndex < lineSegments.length) {
      const subCommandName = lineSegments[segmentIndex];
      const subCommands = currentCommand.commands as AutocompleteCommand[];
      const foundSubCommand = subCommands.find(cmd => cmd.name() === subCommandName);
      
      if (foundSubCommand) {
        currentCommand = foundSubCommand;
        segmentIndex++;
      } else {
        break;
      }
    }

    // If current command has subcommands, suggest them
    if (currentCommand && currentCommand.commands.length > 0) {
      reply(Promise.resolve(currentCommand.commands.map(cmd => cmd.name())));
      return
    }

    const argumentIndex = lineSegments.length - segmentIndex;
    const argumentSuggestions = currentCommand?.argumentSuggestions[argumentIndex]
    if(!argumentSuggestions) {
      return
    }

    const suggestions = typeof argumentSuggestions === 'function'
      ? argumentSuggestions(line)
      : argumentSuggestions
    reply(Promise.resolve(suggestions))
  }
  complete.onAsync('complete', autocompleteCallback as unknown as omelette.CallbackAsync)

  complete.next( () => {
    for (const command of commands) {
      program.addCommand(command);
    }

    // Parse command line arguments
    program.parse(process.argv);
  });

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
}

async function main() {
  program
    .name('envie')
    .description('CLI for managing .env files securely and conveniently')

  await startProgram(program, [
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

}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 