import { Command, CommandOptions } from "commander";

export interface BaseOptions {
  verbose?: boolean;
}

export class AutocompleteCommand extends Command {
  private tree: { [key: string]: string[] } = {};
  
  constructor(name: string) {
    super(name);
    this.tree = {
      [this.name()]: []
    }
  }

  command(nameAndArgs: string, opts?: CommandOptions): ReturnType<this['createCommand']>;
  command(nameAndArgs: string, description: string, opts?: any): this;
  command(nameAndArgs: string, descriptionOrOpts?: string | CommandOptions, opts?: any): any {
    this.tree[this.name()].push(nameAndArgs);
    if (typeof descriptionOrOpts === 'string') {
      return super.command(nameAndArgs, descriptionOrOpts, opts);
    }
    return super.command(nameAndArgs, descriptionOrOpts) as ReturnType<this['createCommand']>;
  }

  getTree(): { [key: string]: string[] } {
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
