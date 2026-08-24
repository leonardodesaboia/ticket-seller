'use client';

import { useQuery } from '@tanstack/react-query';
import { listAdminOrganizations } from '../api/admin.api';
import type { PaginatedResult, AdminOrganizationItem } from '../api/admin.api';

export function useAdminOrganizations(
  params: { cursor?: string; limit?: number },
  devUserId?: string,
) {
  return useQuery<PaginatedResult<AdminOrganizationItem>, Error>({
    queryKey: ['admin', 'organizations', params],
    queryFn: () => listAdminOrganizations(params, devUserId),
    staleTime: 15_000,
  });
}
