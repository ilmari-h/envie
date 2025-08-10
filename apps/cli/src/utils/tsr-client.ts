import { initClient } from '@ts-rest/core';
import { contract } from '@repo/rest';
import { getToken } from './tokens.js';
import { getInstanceUrl } from './config.js';

export function createTsrClient(instanceUrlProp?: string) {
  const instanceUrl = instanceUrlProp ?? getInstanceUrl();
  const apiKey = process.env.ENVIE_ACCESS_TOKEN;
  const token = getToken(instanceUrl);
  if (!token && !apiKey) {
    throw new Error('No authentication token found. Please run "envie login" first.');
  }
  
  return initClient(contract, {
    baseUrl: instanceUrl,
    baseHeaders: apiKey ? {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    } : {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}