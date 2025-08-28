import { Command, CommandOptions } from "commander";
import omelette from "omelette";

export interface BaseOptions {
  verbose?: boolean;
}

export class AutocompleteCommand extends Command {
  private tree: omelette.TreeValue = {};
  
  constructor(name: string) {
    super(name);
    this.tree = {
      [this.name()]: []
    }
  }

  command(nameAndArgs: string, opts?: CommandOptions): ReturnType<this['createCommand']>;
  command(nameAndArgs: string, description: string, opts?: any): this;
  command(nameAndArgs: string, descriptionOrOpts?: string | CommandOptions, opts?: any): any {
    const commands = this.tree[this.name()];
    if (Array.isArray(commands)) {
      commands.push(nameAndArgs);
    }
    if (typeof descriptionOrOpts === 'string') {
      return super.command(nameAndArgs, descriptionOrOpts, opts);
    }
    return super.command(nameAndArgs, descriptionOrOpts) as ReturnType<this['createCommand']>;
  }

  addCommandWithCompletion(command: AutocompleteCommand) {
    this.tree[this.name()] = {
      ...this.tree[this.name()],
      ...command.getTree()
    }
    this.addCommand(command);
  }

  getTree(): omelette.TreeValue {
    return this.tree;
  }
}

export class RootCommand extends Command  {
  createCommand<T extends BaseOptions = BaseOptions>(name: string): AutocompleteCommand & { opts(): T } {
    const cmd = new AutocompleteCommand(name);
    cmd.option('-v, --verbose', 'use verbose logging');
    return cmd as AutocompleteCommand & { opts(): T };
  }
}
