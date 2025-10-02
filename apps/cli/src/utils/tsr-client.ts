import { initClient } from '@ts-rest/core';
import { contract } from '@repo/rest';
import { getToken } from './tokens.js';
import { getInstanceUrl } from './config.js';
import { AccessToken } from '../crypto/access-token.js';

export function createTsrClient(instanceUrlProp?: string) {
  const instanceUrl = instanceUrlProp ?? getInstanceUrl();
  const accessTokenValue = process.env.ENVIE_ACCESS_TOKEN;
  let accessToken: AccessToken | null = null;

  // Validate access token if it exists
  if (accessTokenValue) {
    try {
      accessToken = AccessToken.fromString(accessTokenValue);
    } catch (error) {
      throw new Error('Found ENVIE_ACCESS_TOKEN but the format is invalid. Please double check your access token');
    }
  }

  const loginToken = getToken(instanceUrl);
  if (!loginToken && !accessTokenValue) {
    throw new Error('No authentication token found. Please run "envie login" first.');
  }
  
  return initClient(contract, {
    baseUrl: instanceUrl,
    baseHeaders: accessToken ? {

      // Access token authentication
      // We pass only the token value section of the token, not the entire encoded string
      'x-api-key': accessToken.tokenValue,
      'Content-Type': 'application/json'
    } : {

      // CLI user authentication
      // We pass the login token
      'Authorization': `Bearer ${loginToken}`,
      'Content-Type': 'application/json'
    }
  });
}