import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contract } from '@repo/rest';
import { env } from './env';

export const tsr = initTsrReactQuery(contract, {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include'
});