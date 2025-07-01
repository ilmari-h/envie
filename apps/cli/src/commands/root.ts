import { Command } from "commander";

export interface BaseOptions {
  verbose?: boolean;
}

export class RootCommand extends Command  {
  createCommand<T extends BaseOptions = BaseOptions>(name: string): Command & { opts(): T } {
    const cmd = new Command(name);
    cmd.option('-v, --verbose', 'use verbose logging');
    return cmd as Command & { opts(): T };
  }
}
