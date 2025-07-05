import { initClient } from '@ts-rest/core';
import { contract } from '@repo/rest';
import { getToken } from './tokens.js';

export function createTsrClient(instanceUrl: string) {
  const token = getToken(instanceUrl);
  if (!token) {
    throw new Error('No authentication token found. Please run "envie login" first.');
  }
  
  return initClient(contract, {
    baseUrl: instanceUrl,
    baseHeaders: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}