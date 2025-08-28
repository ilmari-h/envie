import chalk from 'chalk';

interface ConfirmOptions {
  prompt: string;
  defaultNo?: boolean;
  dangerColor?: boolean;
}

/**
 * Prompts the user for confirmation with a consistent style
 * @param options.prompt The main message to show (without the [y/N] suffix)
 * @param options.defaultNo Whether "no" should be the default (capital N), defaults to true
 * @param options.dangerColor Whether to use red color for danger, defaults to true
 * @returns Promise that resolves to true if confirmed, false if denied
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  const { prompt, defaultNo = true, dangerColor = false } = options;
  
  const yesNo = defaultNo ? '[y/N]' : '[Y/n]';
  const message = `${prompt} ${yesNo} `;
  
  process.stdout.write(
    dangerColor ? chalk.red(message) : message
  );

  const response = await new Promise<string>(resolve => {
    process.stdin.once('data', data => {
      resolve(data.toString().trim().toLowerCase());
    });
  });

  if (defaultNo) {
    return response === 'y';
  } else {
    return response !== 'n';
  }
}
