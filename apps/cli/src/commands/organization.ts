import { Command } from 'commander';
import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { parseExpiryDate } from '../utils/time';
import chalk from 'chalk';
import { BaseOptions } from './root';

type CreateOrganizationOptions = BaseOptions & {
  description?: string;
};

type InviteOrganizationOptions = BaseOptions & {
  expiry: string;
  oneTime?: boolean;
};

type SetAccessOptions = BaseOptions & {
  addMembers?: string;
  createEnvironments?: string;
  createProjects?: string;
  editProject?: string;
  editOrganization?: string;
};

export const organizationCommand = new Command('organization')
  .alias('o')
  .description('Manage organizations');


organizationCommand
  .command('list')
  .description('List organizations you have access to')
  .action(async function() {
    const instanceUrl = getInstanceUrl();
    
    try {
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
  .action(async function(organizationPath: string) {
    const instanceUrl = getInstanceUrl();
    
    try {
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
  .action(async function(organizationPath: string) {
    const opts = this.opts<InviteOrganizationOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
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
  .action(async function(organizationName: string) {
    const opts = this.opts<CreateOrganizationOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
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

      console.log(chalk.green(`Organization "${response.body.name}" created successfully.`));
    } catch (error) {
      console.error(chalk.red('Error:', error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

organizationCommand
  .command('join <name> <code>')
  .description('Join an organization using an invite code')
  .action(async function(name: string, code: string) {
    const instanceUrl = getInstanceUrl();
    
    try {
      const client = createTsrClient(instanceUrl);
      const response: { status: number, body: { message: string } } = await client.organizations.acceptOrganizationInvite({
        params: { name, token: code }
      }) as { status: number, body: { message: string } };
      if (response.status === 200) {
        console.log(chalk.green(response.body.message));
      } else {
        console.error(chalk.red(`Failed to join organization: ${response.status} ${response.body.message}`));
      }
    } catch (error) {
      console.error(chalk.red('Failed to join organization'));
      process.exit(1);
    }
  })

const validBoolStr = (str?: string): boolean | undefined => {
  if (!str) return undefined;
  if (str !== 'true' && str !== 'false') {
    console.error(`Error: Permission values must be either "true" or "false", got "${str}"`);
    process.exit(1);
  }
  return str === 'true';
};

organizationCommand
  .command('set-access')
  .description('Update access permissions for a user in an organization')
  .argument('<organization-name>', 'Name of the organization')
  .argument('<user>', 'User name or ID to update permissions for')
  .option('--add-members <true|false>', 'Set permission to add members')
  .option('--create-environments <true|false>', 'Set permission to create environments')
  .option('--create-projects <true|false>', 'Set permission to create projects')
  .option('--edit-project <true|false>', 'Set permission to edit projects')
  .option('--edit-organization <true|false>', 'Set permission to edit organization')
  .action(async function(organizationPath: string, userIdOrPath: string) {
    const opts = this.opts<SetAccessOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      // Convert string "true"/"false" to boolean and validate
      const permissions: Partial<Record<string, boolean>> = {};
      const addMembers = validBoolStr(opts.addMembers);
      const createEnvironments = validBoolStr(opts.createEnvironments);
      const createProjects = validBoolStr(opts.createProjects);
      const editProject = validBoolStr(opts.editProject);
      const editOrganization = validBoolStr(opts.editOrganization);

      if (addMembers !== undefined) permissions.canAddMembers = addMembers;
      if (createEnvironments !== undefined) permissions.canCreateEnvironments = createEnvironments;
      if (createProjects !== undefined) permissions.canCreateProjects = createProjects;
      if (editProject !== undefined) permissions.canEditProject = editProject;
      if (editOrganization !== undefined) permissions.canEditOrganization = editOrganization;

      // Check if at least one permission is being updated
      if (Object.keys(permissions).length === 0) {
        console.error('Error: At least one permission must be specified');
        process.exit(1);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.organizations.updateAccess({
        params: { 
          idOrPath: organizationPath,
        },
        body: {
          userIdOrName: userIdOrPath,
          ...permissions
          }
      });

      if (response.status !== 200) {
        const errorMsg = response.body as { message: string };
        console.error(`Failed to update permissions: ${errorMsg.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });