'use client';

import { useQuery } from '@tanstack/react-query';
import { getFinancialSummary } from '../api/finance.api';
import type { FinancialSummary } from '../types';

export function useFinanceSummary(
  organizationId: string,
  from: string,
  to: string,
  devUserId: string,
) {
  return useQuery<FinancialSummary, Error>({
    queryKey: ['finance', 'summary', organizationId, from, to],
    queryFn: () => getFinancialSummary(organizationId, from, to, devUserId),
    enabled: Boolean(organizationId && devUserId && from && to),
    staleTime: 60_000,
  });
}
