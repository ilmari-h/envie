import { initClient } from '@ts-rest/core';
import { contract } from '@repo/rest';
import { env } from 'next-runtime-env';
import { getAuthenticatedUser } from './auth/helpers';

export async function createTsrClient() {
  const user = await getAuthenticatedUser()
  return initClient(contract, {
    baseUrl: env("NEXT_PUBLIC_API_URL")!,
    credentials: 'include',
    baseHeaders: user ? {
      'Authorization': `Bearer ${user.jwtToken}`
    } : undefined
  });
}