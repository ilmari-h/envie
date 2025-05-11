"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {ReactNode} from 'react';
import { tsr } from './tsr';

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}