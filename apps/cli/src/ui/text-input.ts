import chalk from 'chalk';

interface TextInputOptions {
  prompt: string;
  default?: string;
}

/**
 * Prompts the user for text input with a consistent style
 * @param options.prompt The main message to show
 * @param options.default The default value if user just presses enter
 * @returns Promise that resolves to the user's input or the default value
 */
export async function textInput(options: TextInputOptions): Promise<string> {
  const { prompt, default: defaultValue } = options;
  
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
