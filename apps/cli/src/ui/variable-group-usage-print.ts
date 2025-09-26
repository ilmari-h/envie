import chalk from 'chalk';

interface VariableGroupUsage {
  environmentId: string;
  environmentName: string;
  projectId: string;
  projectName: string;
  appliedAt: Date;
}

interface VariableGroupUsageOptions {
  variableGroupName: string;
  organizationName: string;
  appliedToEnvironments: VariableGroupUsage[];
}

export function printVariableGroupUsage(options: VariableGroupUsageOptions): void {
  const { variableGroupName, organizationName, appliedToEnvironments } = options;

  if (appliedToEnvironments.length === 0) {
    console.log();
    console.log(chalk.gray('◦ ') + chalk.dim('No environments currently use this variable group'));
    console.log();
    return;
  }

  console.log( chalk.bold(`Used by ${appliedToEnvironments.length} ${appliedToEnvironments.length === 1 ? 'environment' : 'environments'}`));

  // Create a clean bullet list with indentation
  appliedToEnvironments.forEach((env, index) => {
    const envPath = `${organizationName}:${env.projectName}:${env.environmentName}`;
    const appliedDate = chalk.gray(`${formatRelativeTime(env.appliedAt)}`);
    
    console.log('  ' + chalk.cyan('•') + ' ' + chalk.white(envPath) + chalk.gray(` (${appliedDate})`));
  });

  console.log();
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return 'just now';
  }
}
