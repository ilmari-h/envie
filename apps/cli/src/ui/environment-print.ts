import chalk from 'chalk';

interface VariableGroup {
  name: string;
  content: Record<string, string>;
}

interface EnvironmentPrintOptions {
  decrypted: boolean;
  variableGroups?: VariableGroup[];
  environmentVars: Record<string, string>;
  environmentName: string;
}

// Color palette for different groups
const GROUP_COLORS = [
  chalk.cyan,
  chalk.green,
  chalk.magenta,
  chalk.yellow,
  chalk.blue,
  chalk.red,
];

function getBoxChars() {
  return {
    topLeft: '╭',
    bottomLeft: '╰',
    horizontal: '─',
    vertical: '│',
    titleRight: '├',
  };
}

function createBox(title: string, content: string[], colorFn: typeof chalk.cyan): string[] {
  const chars = getBoxChars();
  const lines: string[] = [];
  
  // Top border with title bubble - moved 3 spaces to the right
  const titleBubble = ` ${title}`;
  const topLine = colorFn(chars.topLeft + chars.horizontal.repeat(3)) + colorFn(titleBubble);
  lines.push(topLine);
  
  // Content lines
  content.forEach(line => {
    lines.push(colorFn(chars.vertical) + ' ' + line);
  });
  
  // Bottom border - length matches the top line visual width
  const bottomLength = 3 + titleBubble.length;
  const bottomLine = colorFn(chars.bottomLeft + chars.horizontal.repeat(bottomLength - 1));
  lines.push(bottomLine);
  
  return lines;
}

function formatVariableForDisplay(key: string, value: string, decrypted: boolean): string {
  if (!decrypted) {
    return key + '=' + '<encrypted>';
  }
  
  // Color coding for different types of values
  let coloredValue: string;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    coloredValue = chalk.blue.underline(value);
  } else if (value.match(/^\d+$/)) {
    coloredValue = chalk.yellow(value);
  } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    coloredValue = chalk.magenta(value);
  } else if (value.includes('secret') || value.includes('key') || value.includes('password')) {
    coloredValue = chalk.red('***REDACTED***');
  } else {
    coloredValue = chalk.green(value);
  }
  
  return key + '=' + coloredValue;
}

export function printEnvironment(options: EnvironmentPrintOptions): void {
  const { decrypted, variableGroups = [], environmentVars, environmentName } = options;
  
  console.log(); // Empty line for spacing
  
  // Print variable groups in colored boxes
  if (variableGroups.length > 0) {
    variableGroups.forEach((group, index) => {
      const colorFn = GROUP_COLORS[index % GROUP_COLORS.length];
      const content = Object.entries(group.content).map(([key, value]) =>
        formatVariableForDisplay(key, value, decrypted)
      );
      
      if (content.length === 0) {
        content.push(chalk.italic.gray('(no variables)'));
      }
      
      const boxLines = createBox(group.name, content, colorFn);
      boxLines.forEach(line => console.log(line));
      console.log(); // Space between groups
    });
  }
  
  // Print environment-specific variables (not in groups) in a gray box
  const envVarEntries = Object.entries(environmentVars);
  if (envVarEntries.length > 0) {
    const content = envVarEntries.map(([key, value]) =>
      formatVariableForDisplay(key, value, decrypted)
    );
    
    const boxLines = createBox(environmentName, content, chalk.gray);
    boxLines.forEach(line => console.log(line));
    console.log(); // Final spacing
  }
  
  // Summary
  const totalVars = variableGroups.reduce((sum, group) => sum + Object.keys(group.content).length, 0) + envVarEntries.length;
  const summaryColor = totalVars > 0 ? chalk.cyan : chalk.gray;
  console.log(summaryColor(`Total: ${totalVars} variables across ${variableGroups.length} groups + ${envVarEntries.length} environment variables`));
  console.log();
}
