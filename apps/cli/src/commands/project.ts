import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';

type ProjectOptions = {
  instanceUrl?: string;
  organization?: string;
};

type CreateProjectOptions = ProjectOptions & {
  description?: string;
};

export const projectCommand = new Command('project')
  .description('Manage projects');

projectCommand
  .command('list')
  .description('List projects optionally filter by some organization (name or ID)')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .option('-o, --organization <organization>', 'Filter by organization name or ID')
  .action(async function() {
    const opts = this.opts<ProjectOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.projects.getProjects({
        query: opts.organization ? { organization: opts.organization } : {}
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch projects: ${response.status}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Path', key: 'path' },
          { header: 'Organization', key: 'organization' },
          { header: 'Description', key: 'description' },
          { header: 'ID', key: 'id' },
        ],
        response.body.map(project => ({
          path: `${project.organization.name}:${project.name}`,
          description: project.description || '',
          id: project.id
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

projectCommand
  .command('create')
  .description('Create a new project')
  .argument('<project-path>', 'Project path in format "organization-name:project-name"')
  .option('-d, --description <description>', 'Project description')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(projectPath: string) {
    const opts = this.opts<CreateProjectOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      // Validate project path format
      const parts = projectPath.split(':');
      if (parts.length !== 2) {
        console.error('Error: Project path must be in format "organization-name:project-name"');
        process.exit(1);
      }

      const [organizationName, projectName] = parts;
      if (!organizationName.trim() || !projectName.trim()) {
        console.error('Error: Both organization name and project name must be non-empty');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.projects.createProject({
        body: {
          name: projectName.trim(),
          description: opts.description ?? '',
          organizationIdOrName: organizationName.trim()
        }
      });

      if (response.status !== 201) {
        console.error(`Failed to create project: ${response.status}`);
        process.exit(1);
      }

      console.log(`Project "${response.body.name}" created successfully.`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });