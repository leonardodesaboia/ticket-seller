'use client';

import { useQuery } from '@tanstack/react-query';
import { getBalance } from '../api/finance.api';
import type { BalanceResponse } from '../types';

export function useBalance(organizationId: string, devUserId: string) {
  return useQuery<BalanceResponse, Error>({
    queryKey: ['finance', 'balance', organizationId],
    queryFn: () => getBalance(organizationId, devUserId),
    enabled: Boolean(organizationId && devUserId),
    refetchInterval: 30_000, // poll every 30 seconds
    staleTime: 25_000,
  });
}
