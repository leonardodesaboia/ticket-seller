'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { listAdminOrganizations } from '../api/admin.api';
import type { PaginatedResult, AdminOrganizationItem } from '../api/admin.api';

export function useAdminOrganizations(
  params: { cursor?: string; limit?: number },
) {
  const { token } = useAuth();
  return useQuery<PaginatedResult<AdminOrganizationItem>, Error>({
    queryKey: ['admin', 'organizations', params],
    queryFn: () => listAdminOrganizations(params, token ?? ''),
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}
