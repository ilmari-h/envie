import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { printTable } from '../ui/table';
import { RootCommand, BaseOptions } from './root';
import { createEnvironmentHelper } from './utils/create-environment';
import { organizationCompletions, organizationCompletionsWithTrailingColon, variableGroupCompletions } from '../utils/completions';
import { getEnvironment } from './utils/get-environment';
import { EnvironmentPath } from './utils/environment-path';
import { printEnvironment } from '../ui/environment-print';
import { printVariableGroupUsage } from '../ui/variable-group-usage-print';

type VariableGroupOptions = BaseOptions;

type CreateVariableGroupOptions = VariableGroupOptions & {
  secretKeyFile?: string;
  description?: string;
};

type ShowOptions = BaseOptions & {
  backupKey?: string;
  unsafeDecrypt?: boolean;
};

const rootCmd = new RootCommand();
export const variableGroupCommand = rootCmd.createCommand<VariableGroupOptions>('variable-group')
  .alias('vg')
  .description('Manage variable groups');

variableGroupCommand
  .commandWithSuggestions('list')
  .description('List variable groups, optionally filtering by organization')
  .argumentWithSuggestions('[organization]', 'Organization name to filter by', organizationCompletions)
  .action(async function(filterOrganization?: string) {
    const opts = this.opts<VariableGroupOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      if (opts.verbose) {
        console.log(`Connecting to instance: ${instanceUrl}`);
        console.log(`Filter organization: ${filterOrganization || 'none'}`);
      }

      const client = createTsrClient(instanceUrl);
      
      // Build query params - pass organization as path if provided, and indicate we want variable groups
      let queryParams: any = { variableGroups: 'true' };
      if (filterOrganization) {
        queryParams.path = filterOrganization;
      }
      
      if (opts.verbose) {
        console.log(`Query parameters:`, queryParams);
      }
      
      const response = await client.environments.getEnvironments({
        query: queryParams
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch variable groups: ${response.status} ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Found ${response.body.length} variable groups`);
      }

      // Filter for variable groups (those without projects)
      const variableGroups = response.body.filter(env => !env.project);

      printTable(
        [
          { header: 'Path', key: 'path' },
          { header: 'ID', key: 'id' },
          { header: 'Versions', key: 'versions' },
        ],
        variableGroups.map(vg => ({
          path: `${vg.organization?.name ?? 'N/A'}:group:${vg.name}`,
          id: vg.id,
          versions: vg.version?.versionNumber || '0'
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

variableGroupCommand
  .commandWithSuggestions('create')
  .description('Create a new variable group')
  .argumentWithSuggestions('<organization:name>', 'Variable group path (organization:name)', organizationCompletionsWithTrailingColon)
  .argument('[KEY=VALUE...]', 'Optional space-separated key=value pairs')
  .option('--file <path>', 'File containing environment variables')
  .option('--secret-key-file <path>', 'File to store the generated secret key in')
  .option('--description <description>', 'Description for the variable group')
  .action(async function(pathParam: string, keyValuePairs: string[]) {
    const opts = this.opts<CreateVariableGroupOptions & { file?: string }>();
    
    // Parse organization:name format
    const pathParts = pathParam.split(':');
    if (pathParts.length !== 2) {
      console.error('Error: Variable group path must be in format "organization:name"');
      process.exit(1);
    }
    
    const [organization, name] = pathParts;
    
    await createEnvironmentHelper({
      pathParam,
      filePath: opts.file,
      keyValuePairs,
      environmentType: {
        type: 'variableGroup',
        variableGroup: {
          name,
          organization,
          description: opts.description
        }
      }
    }, opts);
  });

variableGroupCommand
  .commandWithSuggestions('show')
  .description('Show a variable group and its usage')
  .argumentWithSuggestions('<path>', 'Variable group path', variableGroupCompletions)
  .option('-b, --backup-key <key-file>', 'Restore the environment from a backup key')
  .option('--unsafe-decrypt', 'Decrypt and print the environment variables to stdout')
  .action(async function(path: string) {
    const opts = this.opts<ShowOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {
      // Get environment data (variable group content)
      const { version, decryptedContent, environment } = await getEnvironment({ path }, opts.unsafeDecrypt ?? false);

      // Create environment variables object (non-grouped variables)
      const environmentVars: Record<string, string> = {};
      if (opts.unsafeDecrypt && decryptedContent) {
        Object.assign(environmentVars, decryptedContent);
      } else {
        // Create encrypted placeholder for environment keys
        version.keys.forEach(key => {
          environmentVars[key] = '<encrypted>';
        });
      }

      // Print environment content
      const environmentPath = new EnvironmentPath(path);
      printEnvironment({
        decrypted: opts.unsafeDecrypt ?? false,
        variableGroups: [],
        environmentVars,
        environmentName: environmentPath.toString()
      });

      // Get variable group usage information
      const client = createTsrClient(instanceUrl);
      
      // Use the environment ID to find the variable group and get its usage
      if (environment) {
          const usageResponse = await client.environments.getVariableGroupInfo({
            params: { variableGroupId: environment.id },
          });
          if (usageResponse.status !== 200) {
            console.error(`Failed to fetch variable group usage: ${usageResponse.status}`);
            process.exit(1);
          }

          printVariableGroupUsage({
            organizationName: environment.organization?.name ?? 'N/A',
            variableGroupName: environmentPath.toString(),
            appliedToEnvironments: usageResponse.body.appliedToEnvironments.map((env: any) => ({
              ...env,
              appliedAt: new Date(env.appliedAt)
            }))
          });

      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });