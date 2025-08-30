import { Command, CommandOptions } from "commander";

export interface BaseOptions {
  verbose?: boolean;
}

export type ArgumentSuggestions = string[] | ((props: {input: string, before: string}) => Promise<string[]>);

export class AutocompleteCommand extends Command {
  argumentSuggestions: ArgumentSuggestions[] = [];
  
  
  constructor(name: string) {
    super(name);
  }

  argumentWithSuggestions<T>(
    arg: string,
    description: string,
    parseArg: (value: string, previous: T) => T,
    suggestions: ArgumentSuggestions,
    defaultValue?: T,
  ): this;
  argumentWithSuggestions(name: string, description: string, suggestions: ArgumentSuggestions, defaultValue?: string): this;
  argumentWithSuggestions<T>(
    arg: string,
    description: string,
    parseArgOrSuggestions: ((value: string, previous: T) => T) | ArgumentSuggestions,
    suggestionsOrDefaultValue?: ArgumentSuggestions | string,
    defaultValue?: T,
  ): this {
    if (typeof parseArgOrSuggestions === 'function' && parseArgOrSuggestions.length === 2) {
      // First overload: with parseArg
      this.argument(arg, description, parseArgOrSuggestions as (value: string, previous: T) => T, defaultValue);
      this.argumentSuggestions.push(suggestionsOrDefaultValue as ArgumentSuggestions);
    } else {
      // Second overload: without parseArg
      this.argument(arg, description, suggestionsOrDefaultValue as string);
      this.argumentSuggestions.push(parseArgOrSuggestions as ArgumentSuggestions);
    }
    return this;
  }

  commandWithSuggestions(nameAndArgs: string, opts?: CommandOptions): AutocompleteCommand {
    const cmd = new AutocompleteCommand(nameAndArgs);
    this.addCommand(cmd, opts);
    return cmd;
  }
}

export class RootCommand extends Command  {
  createCommand<T extends BaseOptions = BaseOptions>(name: string): AutocompleteCommand & { opts(): T } {
    const cmd = new AutocompleteCommand(name);
    cmd.option('-v, --verbose', 'use verbose logging');
    return cmd as AutocompleteCommand & { opts(): T };
  }
}
