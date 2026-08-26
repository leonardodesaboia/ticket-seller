'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getDashboard } from '../api/admin.api';
import type { PlatformDashboard } from '../api/admin.api';

export function useAdminDashboard() {
  const { token } = useAuth();
  return useQuery<PlatformDashboard, Error>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getDashboard(token ?? ''),
    enabled: Boolean(token),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
