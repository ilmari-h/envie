import chalk from 'chalk';
import * as readline from 'readline';

interface TextInputOptions {
  prompt: string;
  default?: string;
  prefill?: boolean;
}

/**
 * Prompts the user for text input with a consistent style
 * @param options.prompt The main message to show
 * @param options.default The default value if user just presses enter
 * @param options.prefill If true, pre-fills the input with the default value for editing
 * @returns Promise that resolves to the user's input or the default value
 */
export async function textInput(options: TextInputOptions): Promise<string> {
  const { prompt, default: defaultValue, prefill = false } = options;
  
  if (prefill && defaultValue) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise<string>((resolve) => {
      rl.question(`${prompt}: `, (answer) => {
        rl.close();
        resolve(answer || defaultValue);
      });
      
      // Pre-fill the input line with the default value
      // This works on most Unix terminals (Linux, macOS)
      if (process.stdout.isTTY) {
        rl.write(defaultValue);
      }
    });
  }
  
  // Original behavior for backwards compatibility
  const defaultText = defaultValue ? chalk.dim(` (${defaultValue})`) : '';
  const message = `${prompt}${defaultText}: `;
  
  process.stdout.write(message);

  const response = await new Promise<string>(resolve => {
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
    });
  });

  return response || defaultValue || '';
}
