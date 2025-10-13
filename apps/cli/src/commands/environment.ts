import { createTsrClient } from '../utils/tsr-client';
import { getInstanceUrl } from '../utils/config';
import { getEnvironment } from './utils/get-environment';
import { printTable } from '../ui/table';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RootCommand, BaseOptions } from './root';
import { UserKeyPair, Ed25519PublicKey, DataEncryptionKey } from '../crypto';
import { EnvironmentPath } from './utils/environment-path';
import { ExpiryFromNow } from './utils/expiry-from-now';
import { filepathCompletions, projectCompletions, environmentCompletions, projectCompletionsWithTrailingColon, userAndTokenCompletions, variableGroupCompletions, variableGroupAndEnvironmentCompletions } from '../utils/completions';
import { confirm } from '../ui/confirm';
import { normalizeEd25519PublicKey } from '../utils/keypair';
import { printEnvironment } from '../ui/environment-print';
import { createEnvironmentHelper } from './utils/create-environment';

type EnvironmentOptions = BaseOptions;

type CreateEnvironmentOptions = EnvironmentOptions;
type ShowOptions = BaseOptions & {
  backupKey?: string;
  unsafeDecrypt?: boolean;
};

const rootCmd = new RootCommand();
export const environmentCommand = rootCmd.createCommand<EnvironmentOptions>('environment')
  .alias('e')
  .description('Manage environments');

environmentCommand
  .commandWithSuggestions('list')
  .description('List environments, optionally filtering by path')
  .argumentWithSuggestions('[path]', 'Path to filter by (organization name or organization:project)', projectCompletions)
  .action(async function(filterPath?: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    
    try {

      if (opts.verbose) {
        console.log(`Connecting to instance: ${instanceUrl}`);
        console.log(`Filter path: ${filterPath || 'none'}`);
      }

      const client = createTsrClient(instanceUrl);
      
      // Determine if path is organization or project path
      const pathParts = filterPath?.split(':') ?? [];
      let queryParams = pathParts.length > 0 ? {path: filterPath} : {};
      
      if (opts.verbose) {
        console.log(`Query parameters:`, queryParams);
      }
      
      const response = await client.environments.getEnvironments({
        query: queryParams
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environments: ${response.status} ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(`Found ${response.body.length} environments`);
      }

      printTable(
        [
          { header: 'Path', key: 'path' },
          // { header: 'Variables', key: 'variables' },
          { header: 'ID', key: 'id' },
          { header: 'Versions', key: 'versions' },
        ],
        
        // Environments that are not variable groups should all have projects
        response.body.filter(env => !!env.project).map(env => {

          // This 'unknown' case should never happen
          const projectName = env.project?.name ?? 'unknown';
          const organizationName = env.project?.organization.name ?? 'unknown';

          return {  
            path: `${organizationName}:${projectName}:${env.name}`,
            versions: env.version?.versionNumber || '0',
            id: env.id
          }
        })
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('create')
  .description('Create a new environment')
  .argumentWithSuggestions('<path>', 'Environment path', projectCompletionsWithTrailingColon)
  .argument('[KEY=VALUE...]', 'Optional space-separated key=value pairs')
  .option('--file <path>', 'File containing environment variables')
  .option('--secret-key-file <path>', 'File to store the generated secret key in')
  .action(async function(pathParam: string, keyValuePairs: string[]) {
    const opts = this.opts<CreateEnvironmentOptions & { file?: string }>();
    const environmentPath = new EnvironmentPath(pathParam);
    
    await createEnvironmentHelper({
      pathParam,
      filePath: opts.file,
      keyValuePairs,
      environmentType: {
        type: 'environment',
        project: environmentPath.projectPath.toString()
      }
    }, opts);
  });

environmentCommand
  .commandWithSuggestions('clone')
  .description('Clone an environment into a new environment')
  .argumentWithSuggestions('<source-path>', 'Environment path to clone', environmentCompletions)
  .argumentWithSuggestions('<target-path>', 'New environment path', projectCompletionsWithTrailingColon)
  .option('--secret-key-file <path>', 'File to store the generated secret key in')
  .action(async function(sourcePathParam: string, targetPathParam: string) {
    const opts = this.opts<CreateEnvironmentOptions & { secretKeyFile?: string }>();

    try {
      const sourcePath = new EnvironmentPath(sourcePathParam);
      const targetPath = new EnvironmentPath(targetPathParam);

      // Fetch and decrypt source environment
      const { decryptedContent } = await getEnvironment({ path: sourcePath }, true);

      if (!decryptedContent) {
        console.error('Error: Failed to decrypt source environment content');
        process.exit(1);
      }

      const keyValuePairs = Object.entries(decryptedContent).map(([key, value]) => `${key}=${value}`);

      // Create target environment with cloned key/value pairs
      await createEnvironmentHelper({
        pathParam: targetPathParam,
        keyValuePairs,
        environmentType: {
          type: 'environment',
          project: targetPath.projectPath.toString()
        }
      }, opts);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('show')
  .description('Show an environment')
  .argumentWithSuggestions('<path>', 'Environment path (or name if rest of the path is specified in envierc.json)', environmentCompletions)
  .option('-b, --backup-key <key-file>', 'Restore the environment from a backup key')
  .option('--unsafe-decrypt', 'Decrypt and print the environment variables to stdout')
  .action(async function(path: string) {
    const opts = this.opts<ShowOptions>();
    
    try {
      // Get environment data
      const { version, environment, decryptedContent } = await getEnvironment({ path: new EnvironmentPath(path) }, opts.unsafeDecrypt ?? false);

      // Process variable groups
      const variableGroups = await Promise.all((version.variableGroups ?? []).map(async vg => {
        if (opts.unsafeDecrypt) {
          const { decryptedContent } = await getEnvironment({ environmentId: vg.environmentId }, true);
          return { 
            name: `${environment.project?.organization.name}:group:${vg.name}`,
            content: decryptedContent || {} 
          };
        } else {
          const { version: vgVersion } = await getEnvironment({ environmentId: vg.environmentId }, false);
          // Create encrypted placeholder object
          const encryptedContent: Record<string, string> = {};
          vgVersion.keys.forEach(key => {
            encryptedContent[key] = '<encrypted>';
          });
          return { 
            name: vg.name, 
            content: encryptedContent 
          };
        }
      }));

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

      // Print environment
      const environmentPath = new EnvironmentPath(path);
      printEnvironment({
        decrypted: opts.unsafeDecrypt ?? false,
        variableGroups,
        environmentVars,
        environmentName: environmentPath.toString()
      });

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });


environmentCommand
  .commandWithSuggestions('update')
  .description('Update an environment\'s content from a file')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<file>', 'Path to .env file', filepathCompletions)
  .action(async function(pathParam: string, filePath: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const client = createTsrClient(instanceUrl);
    const environmentPath = new EnvironmentPath(pathParam);
    const userKeyPair = await UserKeyPair.getInstance();

    try {
      if (opts.verbose) {
        console.log(`Updating environment: ${environmentPath.toString()}`);
        console.log(`Reading from file: ${filePath}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      // Get environment data with decryption
      const { decryptionData, decryptedContent: currentEnvVars } = await getEnvironment({ path: new EnvironmentPath(pathParam) }, true);

      if (!currentEnvVars || !decryptionData) {
        console.error('Error: Failed to decrypt environment content');
        process.exit(1);
      }

      // Validate and read the .env file
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File "${filePath}" does not exist`);
        process.exit(1);
      }

      const absoluteFilePath = path.resolve(filePath);
      let fileContent: string;
      
      try {
        fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
      } catch (error) {
        console.error(`Error: Unable to read file "${filePath}": ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }

      // Parse .env file content
      const envVars = parseEnv(fileContent);
      const parsedEnvFileContent = Object.entries(envVars).map(([key, value]) => `${key}=${value}`).join('\n');

      if (Object.keys(envVars).length === 0) {
        console.error('Error: No valid environment variables found in the file');
        process.exit(1);
      }

      if (opts.verbose) {
        console.log('Parsed .env file content:');
        console.log(JSON.stringify(envVars, null, 2));
        console.log(`\nEnvironment path: ${environmentPath}`);
        console.log(`Found ${Object.keys(envVars).length} environment variables`);
      }
      
      try {
        const dek = userKeyPair.unwrapKey({
          wrappedKey: decryptionData.wrappedEncryptionKey,
          ephemeralPublicKey: decryptionData.ephemeralPublicKey,
        });


        // Compare old and new environment variables
        const currentKeys = new Set(Object.keys(currentEnvVars));
        const newKeys = new Set(Object.keys(envVars));
        
        const addedKeys = [...newKeys].filter(key => !currentKeys.has(key));
        const deletedKeys = [...currentKeys].filter(key => !newKeys.has(key));
        const modifiedKeys = [...newKeys].filter(key => 
          currentKeys.has(key) && currentEnvVars[key] !== envVars[key as keyof typeof envVars]
        );

        // Show diff
        console.log('\nChanges to be made:');
        
        if (addedKeys.length === 0 && deletedKeys.length === 0 && modifiedKeys.length === 0) {
          console.log(chalk.gray('No changes detected.'));
          process.exit(0);
        }

        // Show added keys (green with +)
        addedKeys.forEach(key => {
          console.log(chalk.green(`+ ${key}`));
        });

        // Show modified keys (yellow with M)
        modifiedKeys.forEach(key => {
          console.log(chalk.yellow(`M ${key}`));
        });

        // Show deleted keys (red with -)
        deletedKeys.forEach(key => {
          console.log(chalk.red(`- ${key}`));
        });

        // Show summary and confirm
        const summary = [];
        if (addedKeys.length > 0) summary.push(`${addedKeys.length} new`);
        if (modifiedKeys.length > 0) summary.push(`${modifiedKeys.length} modified`);
        if (deletedKeys.length > 0) summary.push(`${deletedKeys.length} deleted`);

        console.log(`\Summary: ${summary.join(', ')}. Update environment with these changes? (y/N)`);
        
        const confirmed = await confirm({
          prompt: '',
          defaultNo: true
        });

        if (!confirmed) {
          process.exit(0);
        }

        const encryptedEnvironment = dek.encryptContent(parsedEnvFileContent);

        // Update environment content
        const response = await client.environments.updateEnvironmentContent({
          params: {
            idOrPath: environmentPath.toString()
          },
          body: {
            content: {
              keys: encryptedEnvironment.keys,
              ciphertext: encryptedEnvironment.ciphertext,
              signature: userKeyPair.sign(encryptedEnvironment.ciphertext)
            }
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to update environment: ${response.status}`);
          process.exit(1);
        }

        process.exit(0);
      } catch (error) {
        console.error('Error during encryption:', error instanceof Error ? error.message : error);
        process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('set-access')
  .description('Grant or update access to an environment for a user')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<user-or-token>', 'User name, token name, or ID to grant access to', userAndTokenCompletions)
  .option('--write [true|false]', 'Grant write access (default: false)', (value) => {
    if (value && value === 'false') {
      return false;
    } else {
      return true;
    }
  })
  .option('--expiry <date>', 'Access expiry date in duration format (e.g., "1h", "1h30m", "1d", "1w", "1m", "1y")')
  .action(async function(path: string, userIdOrName: string) {
    const opts = this.opts<EnvironmentOptions & { write?: boolean, expiry?: string }>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Parse expiry date if provided
      const expiryDate = opts.expiry ? new ExpiryFromNow(opts.expiry) : undefined;

      const client = createTsrClient(instanceUrl);
      
      // Get environment access key and wrap it with the user's public keys
      const userKeyPair = await UserKeyPair.getInstance();
      const [myAccess, targetPublicKeys] = await Promise.all([
        client.publicKeys.getDecryptionKeys({
          params: {
            // Request decryption data for the user's public key
            pubkeyBase64Url: userKeyPair.publicKey.toBase64Url()
          },
          query: {
            environment: environmentPath.toString()
          }
        }),
        client.publicKeys.getPublicKeys({
          params: { userOrTokenNameOrId: userIdOrName }
        })
      ]);
      if (myAccess.status !== 200 ) {
        console.error(`Failed to get environment access keys: ${(myAccess.body as { message: string }).message}`);
        process.exit(1);
      }
      if (targetPublicKeys.status !== 200) {
        console.error(`Failed to get user public keys: ${(targetPublicKeys.body as { message: string }).message}`);
        process.exit(1);
      }

      if(myAccess.body.deks.length === 0) {
        console.error('No decryption data found for environment');
        process.exit(1);
      }
      const [decryptionData] = myAccess.body.deks;

      const dek = userKeyPair.unwrapKey({
        wrappedKey: decryptionData.wrappedDek,
        ephemeralPublicKey: decryptionData.ephemeralPublicKey,
      });
      const wrappedDeks = targetPublicKeys.body.publicKeys.map(
        pk => dek.wrap(new Ed25519PublicKey(normalizeEd25519PublicKey(pk.valueBase64)))
      );
      const response = await client.environments.setEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() },
        body: {
          userOrAccessToken: userIdOrName,
          write: opts.write,
          expiresAt: expiryDate?.toDate().toISOString(),
          decryptionData: wrappedDeks.map(key => ({
            publicKeyBase64: key.publicKeyBase64,
            wrappedEncryptionKey: key.wrappedKey,
            ephemeralPublicKey: key.ephemeralPublicKey
          })),
          signature: userKeyPair.sign(wrappedDeks.map(key => key.publicKeyBase64).join(''))
        }
      });

      if (response.status !== 200) {
        console.error(`Failed to set environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('remove-access')
  .description('Remove a user\'s access to an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<user-or-token>', 'User or token to remove access from', userAndTokenCompletions)
  .action(async function(path: string, userIdOrName: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.environments.deleteEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() },
        body: { userIdOrName }
      });

      if (response.status !== 200) {
        console.error(`Failed to remove environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('list-access')
  .description('List users and tokens with access to an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .action(async function(path: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      const client = createTsrClient(instanceUrl);
      const response = await client.environments.listEnvironmentAccess({
        params: { idOrPath: environmentPath.toString() }
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environment access: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      printTable(
        [
          { header: 'Name', key: 'name' },
          { header: 'Type', key: 'type' },
          { header: 'ID', key: 'id' },
          { header: 'Write Access', key: 'write' },
        ],
        response.body.users.map(user => ({
          name: user.name,
          type: user.type,
          id: user.id,
          write: user.write ? '✓' : '✗'
        }))
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('audit')
  .description('Show version history of an environment')
  .argumentWithSuggestions('<path>', 'Environment path', variableGroupAndEnvironmentCompletions)
  .action(async function(path: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      if (opts.verbose) {
        console.log(`Fetching version history for: ${environmentPath.toString()}`);
        console.log(`Instance URL: ${instanceUrl}`);
      }

      const client = createTsrClient(instanceUrl);
      const response = await client.environments.getEnvironmentVersions({
        params: { idOrPath: environmentPath.toString() }
      });

      if (response.status !== 200) {
        console.error(`Failed to fetch environment versions: ${response.status} ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      const versions = response.body;

      if (versions.length === 0) {
        console.log(chalk.yellow('No versions found for this environment.'));
        return;
      }

      versions.forEach((version, index) => {
        const versionNumber = chalk.bold.cyan(`v${version.versionNumber}`);
        const date = chalk.gray(new Date(version.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }));
        const author = chalk.green(version.author.name);
        const isLatest = index === 0 ? chalk.yellow(' (latest)') : '';
        
        console.log(`${versionNumber} ${date} by ${author}${isLatest}`);
        
        if (opts.verbose && version.keys.length > 0) {
          console.log(chalk.gray(`    Keys: ${version.keys.join(', ')}`));
        }
      });

      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.dim(`Total versions: ${versions.length}`));

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('delete')
  .description('Delete an environment and all its data')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .action(async function(path: string) {
    const instanceUrl = getInstanceUrl();
    const environmentPath = new EnvironmentPath(path);
    
    try {
      // Ask for confirmation
      const confirmed = await confirm({
        prompt: `Are you sure you want to delete environment "${environmentPath.toString()}"? This action cannot be undone.`,
        dangerColor: true
      });

      if (!confirmed) {
        process.exit(0);
      }

      const client = createTsrClient(instanceUrl);
      const deleteResponse = await client.environments.deleteEnvironment({
        params: { idOrPath: environmentPath.toString() }
      });

      if (deleteResponse.status !== 200) {
        console.error(`Failed to delete environment: ${(deleteResponse.body as { message: string }).message}`);
        process.exit(1);
      }

      console.log(chalk.green('Environment deleted successfully.'));
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('add-group')
  .description('Add a variable group as a dependency to an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<variable-group>', 'Variable group to add', variableGroupCompletions)
  .action(async function(path: string, variableGroup: string) {
    const instanceUrl = getInstanceUrl();
    
    try {
      const client = createTsrClient(instanceUrl);
      const environmentPath = new EnvironmentPath(path);
      
      const response = await client.environments.addVariableGroup({
        params: { environmentPath: environmentPath.toString(), variableGroupPath: variableGroup },
      });

      if (response.status !== 200) {
        console.error(`Failed to attach variable group: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('remove-group')
  .description('Remove a variable group from an environment')
  .argumentWithSuggestions('<path>', 'Environment path', environmentCompletions)
  .argumentWithSuggestions('<variable-group>', 'Variable group to remove', variableGroupCompletions)
  .action(async function(path: string, variableGroup: string) {
    const instanceUrl = getInstanceUrl();
    
    try {
      const client = createTsrClient(instanceUrl);
      const environmentPath = new EnvironmentPath(path);
      
      const response = await client.environments.removeVariableGroup({
        params: { environmentPath: environmentPath.toString(), variableGroupPath: variableGroup },
      });

      if (response.status !== 200) {
        console.error(`Failed to remove variable group: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

environmentCommand
  .commandWithSuggestions('rollback')
  .description('Rollback an environment to a previous version, creating a new version with content of the selected version')
  .argumentWithSuggestions('<path>', 'Environment or variable group path', variableGroupAndEnvironmentCompletions)
  .argument('<version>', 'Version number to rollback to (use audit command to list versions)')
  .action(async function(path: string, version: string) {
    const opts = this.opts<EnvironmentOptions>();
    const instanceUrl = getInstanceUrl();
    const versionNumber = (() => { try { return parseInt(version, 10); } catch (error) {
      console.error('Error: Invalid version number');
      process.exit(1);
    }})();
    
    try {
      const client = createTsrClient(instanceUrl);
      const userKeyPair = await UserKeyPair.getInstance();
      const environmentPath = new EnvironmentPath(path);
      const environmentPathWithVersion = new EnvironmentPath(path + `@${versionNumber}`);

      if (opts.verbose) {
        console.log(`Rolling back ${environmentPath.toString()} to version ${versionNumber}`);
      }

      // Get the old version data (the version we want to rollback to)
      const { version: oldVersion, decryptedContent } = await getEnvironment({ path: environmentPathWithVersion }, true);
      
      if (!decryptedContent) {
        console.error('Error: Could not decrypt content from the specified version');
        process.exit(1);
      }

      // Get current environment data to access the current DEK
      const { decryptionData } = await getEnvironment({ path: environmentPath }, false);
      
      if (!decryptionData) {
        console.error('Error: Could not get decryption data for current environment');
        process.exit(1);
      }

      // Unwrap the current environment's encryption key
      const dek = userKeyPair.unwrapKey({
        wrappedKey: decryptionData.wrappedEncryptionKey,
        ephemeralPublicKey: decryptionData.ephemeralPublicKey
      });

      // Convert decrypted content back to env format
      const envContent = Object.entries(decryptedContent)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Encrypt the old version's content
      const encryptedContent = dek.encryptContent(envContent);

      const response = await client.environments.updateEnvironmentContent({
        params: {
          idOrPath: environmentPath.toString()
        },
        body: {
          content: {
            keys: encryptedContent.keys,
            ciphertext: encryptedContent.ciphertext,
            signature: userKeyPair.sign(encryptedContent.ciphertext)
          },
          rollbackToVersionId: oldVersion.id
        }
      });

      if (response.status !== 200) {
        console.error(`Failed to rollback environment: ${response.status}`, (response.body as { message: string }).message);
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });