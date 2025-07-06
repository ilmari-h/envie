import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseExpiryDate } from '../utils/time';

type OrganizationOptions = {
  instanceUrl?: string;
};

type CreateOrganizationOptions = OrganizationOptions & {
  description?: string;
};

type InviteOrganizationOptions = OrganizationOptions & {
  expiry: string;
  oneTime?: boolean;
};

export const organizationCommand = new Command('organization')
  .alias('o')
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
  .command('members')
  .description('Get members of an organization')
  .argument('<organization-name>', 'Name of the organization')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(organizationPath: string) {
    const opts = this.opts<OrganizationOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.organizations.getOrganizationMembers({
        params: { idOrPath: organizationPath }
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch organization members: ${response.status}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Name', key: 'name' },
          { header: 'Type', key: 'type' },
          { header: 'ID', key: 'id' },
          { header: 'Add Members', key: 'canAddMembers' },
          { header: 'Create Environments', key: 'canCreateEnvironments' },
          { header: 'Create Projects', key: 'canCreateProjects' },
          { header: 'Edit Project', key: 'canEditProject' },
          { header: 'Edit Organization', key: 'canEditOrganization' },
        ],
        response.body.map(member => ({
          name: member.name,
          type: member.type,
          id: member.id,
          canAddMembers: member.permissions.canAddMembers ? '✓' : '✗',
          canCreateEnvironments: member.permissions.canCreateEnvironments ? '✓' : '✗',
          canCreateProjects: member.permissions.canCreateProjects ? '✓' : '✗',
          canEditProject: member.permissions.canEditProject ? '✓' : '✗',
          canEditOrganization: member.permissions.canEditOrganization ? '✓' : '✗'
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

organizationCommand
  .command('invite')
  .description('Create an organization invite link')
  .argument('<organization-name>', 'Name of the organization')
  .requiredOption('--expiry <date>', 'Invite expiry date in YYYY-MM-DD format (e.g., "2024-12-31")')
  .option('--one-time', 'Make this a one-time use invite (default: false)')
  .option('--instance-url <url>', 'URL of the server to connect to')
  .action(async function(organizationPath: string) {
    const opts = this.opts<InviteOrganizationOptions>();
    const instanceUrl = opts.instanceUrl ?? getInstanceUrl();
    
    try {
      if (!instanceUrl) {
        console.error('Error: Instance URL not set. Please run "envie config instance-url <url>" first or use --instance-url flag.');
        process.exit(1);
      }

      // Parse expiry date
      try {
        parseExpiryDate(opts.expiry);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.organizations.createOrganizationInvite({
        params: { idOrPath: organizationPath },
        body: {
          expiresAt: opts.expiry,
          oneTimeUse: opts.oneTime ?? false
        }
      });

      if (response.status !== 201){
        console.error(`Failed to create organization invite: ${response.status} ${response.body}`);
        process.exit(1);
      }

      console.log("Invite link:")
      console.log(response.body.inviteUrl);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

organizationCommand
  .command('create')
  .description('Create a new organization')
  .argument('<name>', 'Organization name')
  .option('-d, --description <description>', 'Organization description')
  .option('--instance-url', 'URL of the server to connect to')
  .action(async function(organizationName: string) {
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
          name: organizationName,
          description: opts.description ?? ''
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