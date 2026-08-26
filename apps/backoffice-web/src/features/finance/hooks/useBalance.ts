'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getBalance } from '../api/finance.api';
import type { BalanceResponse } from '../types';

export function useBalance(organizationId: string) {
  const { token } = useAuth();
  return useQuery<BalanceResponse, Error>({
    queryKey: ['finance', 'balance', organizationId],
    queryFn: () => getBalance(organizationId, token ?? ''),
    enabled: Boolean(organizationId && token),
    refetchInterval: 30_000, // poll every 30 seconds
    staleTime: 25_000,
  });
}
