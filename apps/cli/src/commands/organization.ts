import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';

type OrganizationOptions = {
  instanceUrl?: string;
};

type CreateOrganizationOptions = OrganizationOptions & {
  name: string;
  description?: string;
};

export const organizationCommand = new Command('organization')
  .description('Manage organizations');


organizationCommand
  .command('list')
  .description('List organizations you have access to')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function() {
    const opts = this.opts<OrganizationOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.organizations.getOrganizations();

      if (response.status !== 200) {
        console.error(`Failed to fetch organizations: ${response.status}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Name', key: 'name' },
          { header: 'Description', key: 'description' },
          { header: 'Projects', key: 'projects' },
          { header: 'ID', key: 'id' },
        ],
        response.body.map(org => ({
          name: org.name,
          description: org.description || '',
          projects: org.projects,
          id: org.id
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

organizationCommand
  .command('create')
  .description('Create a new organization')
  .requiredOption('-n, --name <name>', 'Organization name')
  .option('-d, --description <description>', 'Organization description')
  .option('--instance-url', 'URL of the server to connect to')
  .action(async function() {
    const opts = this.opts<CreateOrganizationOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.organizations.createOrganization({
        body: {
          name: opts.name,
          description: opts.description
        }
      });

      if (response.status !== 201) {
        console.error(`Failed to create organization: ${response.status}`);
        process.exit(1);
      }

      console.log(`Organization "${response.body.name}" created successfully.`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });