'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { listVenues } from '../api/venues.api';

export function useListVenues(organizationId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['venues', organizationId],
    queryFn: () => listVenues(organizationId, token ?? ''),
    enabled: Boolean(organizationId && token),
  });
}
