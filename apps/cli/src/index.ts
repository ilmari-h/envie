#!/usr/bin/env node

import { program, Command } from 'commander';
import omelette from 'omelette';
import { loginCommand } from './commands/login';
import { configCommand } from './commands/config';
import { organizationCommand } from './commands/organization';
import { projectCommand } from './commands/project';
import { environmentCommand } from './commands/environment';
import { variableGroupCommand } from './commands/variable-groups';
import { setCommand, unsetCommand } from './commands/set';
import { execCommand } from './commands/exec';
import { accessTokenCommand } from './commands/access-tokens';
import { AutocompleteCommand } from './commands/root';
import logger from './logging';
import { checkIfFirstTime, wizard } from './wizard';
import { getDotfileEnvironment, getWorkspaceProjectPath } from './utils/config';
import chalk from 'chalk';
import { checkUpdateAvailable, doVersionCheck, getCliVersion } from './utils/version';

async function startProgram(program: Command, commands: AutocompleteCommand[]) {

  const complete = omelette(`envie`);

  const autocompleteCallback = (fragment: string, {reply, before, line}: omelette.CallbackAsyncValue) => {
    logger.info(`Autocomplete callback: ${fragment}, ${before}, ${line}`);
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
      const subCommands = currentCommand.commands as (AutocompleteCommand[]);
      const foundSubCommand = subCommands.find(cmd => cmd.name() === subCommandName);
      
      if (foundSubCommand ) {

        // Regular `commander.Command` instance
        if(!(foundSubCommand instanceof AutocompleteCommand)) {
          return
        }

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
      ? argumentSuggestions({input: typingInput ?? "", before})
      : argumentSuggestions
    reply(Promise.resolve(suggestions))
  }
  
  // Setup autocomplete
  complete.onAsync('complete', autocompleteCallback as unknown as omelette.CallbackAsync)

  // Initialize program
  complete.next( async () => {

    // Version command
    const versionOutput = await doVersionCheck();
    program.version(
      getCliVersion() + (versionOutput ? `\n\n${versionOutput}` : ''),
    );

    program.addHelpText('afterAll', versionOutput ? `\n\n${versionOutput}` : '');

    //Add commands
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

  const workspaceProjectPath = getWorkspaceProjectPath()
  const defaultEnvironment = getDotfileEnvironment()
  const defaultEnvironmentPath = workspaceProjectPath ? `${workspaceProjectPath}:${defaultEnvironment}` : defaultEnvironment
  const defaultEnvironmentDisplay = defaultEnvironment ? `\n\n${chalk.bold.green('Default environment:')} ${chalk.bold.white(defaultEnvironmentPath)}` : ''

  logger.info('Starting program');
  program
    .name('envie')
    .description(`CLI for managing environment variables${defaultEnvironmentDisplay}`)
  
  const firstTime = checkIfFirstTime()
  if ((firstTime && process.argv.length <= 2) || process.argv.includes('--wizard')) {
    await wizard()
    process.exit(0)
  } else {
    await startProgram(program, [
      loginCommand,
      execCommand,
      setCommand,
      unsetCommand,
      environmentCommand,
      variableGroupCommand,
      projectCommand,
      organizationCommand,
      configCommand,
      accessTokenCommand,
    ]);
  }

}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
}); 