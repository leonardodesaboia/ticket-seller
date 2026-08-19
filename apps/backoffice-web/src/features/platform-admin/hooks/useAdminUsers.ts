'use client';

import { useQuery } from '@tanstack/react-query';
import { listAdminUsers } from '../api/admin.api';
import type { PaginatedResult, AdminUserItem } from '../api/admin.api';

export function useAdminUsers(
  params: { cursor?: string; limit?: number },
  devUserId?: string,
) {
  return useQuery<PaginatedResult<AdminUserItem>, Error>({
    queryKey: ['admin', 'users', params],
    queryFn: () => listAdminUsers(params, devUserId),
    staleTime: 15_000,
  });
}
