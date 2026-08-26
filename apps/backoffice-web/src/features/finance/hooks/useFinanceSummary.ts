'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getFinancialSummary } from '../api/finance.api';
import type { FinancialSummary } from '../types';

export function useFinanceSummary(
  organizationId: string,
  from: string,
  to: string,
) {
  const { token } = useAuth();
  return useQuery<FinancialSummary, Error>({
    queryKey: ['finance', 'summary', organizationId, from, to],
    queryFn: () => getFinancialSummary(organizationId, from, to, token ?? ''),
    enabled: Boolean(organizationId && token && from && to),
    staleTime: 60_000,
  });
}
