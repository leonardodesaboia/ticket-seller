'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { listAdminUsers } from '../api/admin.api';
import type { PaginatedResult, AdminUserItem } from '../api/admin.api';

export function useAdminUsers(
  params: { cursor?: string; limit?: number },
) {
  const { token } = useAuth();
  return useQuery<PaginatedResult<AdminUserItem>, Error>({
    queryKey: ['admin', 'users', params],
    queryFn: () => listAdminUsers(params, token ?? ''),
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}
