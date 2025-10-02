import { createTsrClient } from '../../utils/tsr-client';
import { getInstanceUrl } from '../../utils/config';
import { parseEnv } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { UserKeyPair, Ed25519PublicKey, DataEncryptionKey } from '../../crypto';
import { EnvironmentPath } from './environment-path';

export interface CreateEnvironmentOptions {
  verbose?: boolean;
  secretKeyFile?: string;
}

export interface CreateEnvironmentParams {
  pathParam: string;
  filePath?: string;
  keyValuePairs?: string[];
  environmentType: {
    type: 'environment';
    project: string;
  } | {
    type: 'variableGroup';
    variableGroup: {
      name: string;
      organization: string;
      description?: string;
    };
  };
}

export async function createEnvironmentHelper(
  params: CreateEnvironmentParams,
  opts: CreateEnvironmentOptions = {}
): Promise<{ dekBase64: string }> {
  const instanceUrl = getInstanceUrl();
  const client = createTsrClient(instanceUrl);
  const environmentPath = params.environmentType.type === 'environment'
    ? new EnvironmentPath(params.pathParam)
    : undefined;
  
  try {

    // Parse key=value pairs from command line
    const inlineVars: Record<string, string> = {};
    if (params.keyValuePairs && params.keyValuePairs.length > 0) {
      for (const pair of params.keyValuePairs) {
        const equalIndex = pair.indexOf('=');
        if (equalIndex === -1) {
          console.error(`Error: Invalid key=value pair "${pair}". Expected format: KEY=VALUE`);
          process.exit(1);
        }
        const key = pair.substring(0, equalIndex);
        const value = pair.substring(equalIndex + 1);
        
        if (!key) {
          console.error(`Error: Empty key in pair "${pair}"`);
          process.exit(1);
        }
        
        inlineVars[key] = value;
      }
    }

    // Validate and read the .env file
    let fileVars: Record<string, string> = {};
    if (params.filePath) {
      if (!fs.existsSync(params.filePath)) {
        console.error(`Error: File "${params.filePath}" does not exist`);
        process.exit(1);
      }

      let fileContent: string;
      try {
        const absoluteFilePath = path.resolve(params.filePath);
        fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
      } catch (error) {
        console.error(`Error: Unable to read file "${params.filePath}": ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }

      // Parse .env file content
      const parsedVars = parseEnv(fileContent);
      fileVars = parsedVars as Record<string, string>;
    }

    // Check for conflicts between file and inline variables
    const conflictingKeys = Object.keys(inlineVars).filter(key => key in fileVars);
    if (conflictingKeys.length > 0) {
      console.error(`Error: Conflicting keys found between file and command line arguments:`);
      for (const key of conflictingKeys) {
        console.error(`  ${key}: file="${fileVars[key]}", command line="${inlineVars[key]}"`);
      }
      console.error('Please remove duplicates and try again.');
      process.exit(1);
    }

    // Merge file variables and inline variables
    const envVars = { ...fileVars, ...inlineVars };
    const parsedEnvFileContent = Object.entries(envVars).map(([key, value]) => `${key}=${value}`).join('\n');

    // Get user's keypair for encryption
    const [userKeyPair, userData] = await Promise.all([
      UserKeyPair.getInstance(),
      client.user.getUser()
    ]);

    if (userData.status !== 200 ) {
      console.error(`Failed to get user data: ${(userData.body as { message: string }).message}`);
      process.exit(1);
    }

    if (opts.verbose) {
      console.log('Parsed .env file content:');
      console.log(JSON.stringify(envVars, null, 2));
      console.log(`Found ${Object.keys(envVars).length} environment variables`);
    }
    
    try {

      if (userData.body.publicKeys.length === 0) {
        console.error('No public keys found for user, please add one using `envie config add-pubkey`');
        process.exit(1);
      }

      // Create DEK wrapped with just the user's own public key
      const { encryptedEnvironment, wrappedKeys, dekBase64 } = DataEncryptionKey.newWithPKE(
        userData.body.publicKeys.map(pk => new Ed25519PublicKey(pk.valueBase64)),
        parsedEnvFileContent
      );


      const signature = userKeyPair.sign(encryptedEnvironment.ciphertext);
      if (opts.verbose) {
        console.log(signature);
      }
      
      // Create environment
      const response = await client.environments.createEnvironment({
        body: {
          name: params.environmentType.type === 'environment'
            ? environmentPath!.environmentName
            : params.environmentType.variableGroup.name,
          environmentType: params.environmentType,
          content: {
            keys: encryptedEnvironment.keys,
            ciphertext: encryptedEnvironment.ciphertext,
            signature: signature
          },
          decryptionData: wrappedKeys.map(key => ({
            publicKeyBase64: key.publicKeyBase64,
            wrappedEncryptionKey: key.wrappedKey,
            ephemeralPublicKey: key.ephemeralPublicKey
          }))
        }
      });

      if (response.status !== 201) {
        console.error(`Failed to create ${params.environmentType.type}: ${(response.body as { message: string }).message}`);
        process.exit(1);
      }

      const typeLabel = params.environmentType.type === 'environment' ? 'Environment' : 'Variable group';
      console.log(chalk.green(`${typeLabel} created!`));

      // Write the secret key to a file or display it
      if (opts.secretKeyFile) {
        fs.writeFileSync(opts.secretKeyFile, `${dekBase64}\n`, 'utf-8');
        console.log(
          `Backup secret key written to ${opts.secretKeyFile}.\n`
          + `It can be used to recover this ${params.environmentType.type}'s content if you ever lose your keypair.`);
      } else {
        console.log(
          `Backup secret key: ${dekBase64}\n`
          + chalk.red("STORE IT SOMEWHERE SAFE!\n")
          + `It can be used to recover this ${params.environmentType.type}'s content if you ever lose your keypair.`);
      }

      return { dekBase64 };

    } catch (error) {
      console.error('Error during encryption:', error instanceof Error ? error.message : error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
