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
    middleLeft: '╭',
  };
}

function createConnectedBox(title: string, content: string[], colorFn: typeof chalk.cyan, isFirst: boolean, isLast: boolean): string[] {
  const chars = getBoxChars();
  const lines: string[] = [];
  
  // Title line
  const titleBubble = ` ${title}`;
  let titleLine: string;
  
  if (isFirst) {
    titleLine = colorFn(chars.topLeft + chars.horizontal.repeat(3)) + colorFn(titleBubble);
  } else {
    titleLine = colorFn(chars.middleLeft + chars.horizontal.repeat(3)) + colorFn(titleBubble);
  }
  lines.push(titleLine);
  
  // Content lines
  content.forEach(line => {
    lines.push(colorFn(chars.vertical) + ' ' + line);
  });
  
  // Add spacing line after content (except for the last box)
  if (!isLast) {  
    lines.push(colorFn(chars.vertical));
  }
  
  // Bottom border only for the last box
  if (isLast) {
    const bottomLength = 3 + titleBubble.length;
    const bottomLine = colorFn(chars.bottomLeft + chars.horizontal.repeat(bottomLength - 1));
    lines.push(bottomLine);
  }
  
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
  } else {
    coloredValue = chalk.green(value);
  }
  
  return key + '=' + coloredValue;
}

function detectConflicts(variableGroups: VariableGroup[], environmentVars: Record<string, string>, environmentName: string): Record<string, string[]> {
  const keyToSources: Record<string, string[]> = {};
  
  // Track keys from variable groups
  variableGroups.forEach(group => {
    Object.keys(group.content).forEach(key => {
      if (!keyToSources[key]) {
        keyToSources[key] = [];
      }
      keyToSources[key].push(group.name);
    });
  });
  
  // Track keys from environment variables
  Object.keys(environmentVars).forEach(key => {
    if (!keyToSources[key]) {
      keyToSources[key] = [];
    }
    keyToSources[key].push(environmentName);
  });
  
  // Filter to only conflicts (keys with multiple sources)
  const conflicts: Record<string, string[]> = {};
  Object.entries(keyToSources).forEach(([key, sources]) => {
    if (sources.length > 1) {
      conflicts[key] = sources;
    }
  });
  
  return conflicts;
}

export function printEnvironment(options: EnvironmentPrintOptions): void {
  const { decrypted, variableGroups = [], environmentVars, environmentName } = options;
  
  console.log(); // Empty line for spacing
  
  // Collect all sections to display
  const sections: Array<{ title: string, content: string[], colorFn: typeof chalk.cyan }> = [];
  
  // Add environment-specific variables first if they exist
  const envVarEntries = Object.entries(environmentVars);
  if (envVarEntries.length > 0) {
    const content = envVarEntries.map(([key, value]) =>
      formatVariableForDisplay(key, value, decrypted)
    );
    
    sections.push({
      title: `${environmentName} (${envVarEntries.length} ${envVarEntries.length === 1 ? 'variable' : 'variables'})`,
      content,
      colorFn: chalk.gray
    });
  }
  
  // Add variable groups after environment variables
  variableGroups.forEach((group, index) => {
    const colorFn = GROUP_COLORS[index % GROUP_COLORS.length];
    const content = Object.entries(group.content).map(([key, value]) =>
      formatVariableForDisplay(key, value, decrypted)
    );
    
    if (content.length === 0) {
      content.push(chalk.italic.gray('(no variables)'));
    }
    
    const variableCount = Object.keys(group.content).length;
    sections.push({
      title: `${group.name} (${variableCount} ${variableCount === 1 ? 'variable' : 'variables'})`,
      content,
      colorFn
    });
  });
  
  // Print all sections as connected boxes
  if (sections.length > 0) {
    sections.forEach((section, index) => {
      const isFirst = index === 0;
      const isLast = index === sections.length - 1;
      
      const boxLines = createConnectedBox(section.title, section.content, section.colorFn, isFirst, isLast);
      boxLines.forEach(line => console.log(line));
    });
    console.log(); // Final spacing
  }
  
  // Check for conflicts and display warning
  const conflicts = detectConflicts(variableGroups, environmentVars, environmentName);
  if (Object.keys(conflicts).length > 0) {
    console.log(chalk.yellow.bold('Warning: duplicate keys:'));
    Object.entries(conflicts).forEach(([key, sources]) => {
      const sourceList = sources.join(', ');
      console.log(chalk.yellow(`${key} (${sourceList})`));
    });
    console.log();
  }
}
