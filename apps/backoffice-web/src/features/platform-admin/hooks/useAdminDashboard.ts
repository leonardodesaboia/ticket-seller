'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/admin.api';
import type { PlatformDashboard } from '../api/admin.api';

export function useAdminDashboard(devUserId?: string) {
  return useQuery<PlatformDashboard, Error>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getDashboard(devUserId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
