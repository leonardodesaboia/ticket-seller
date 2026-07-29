'use client';

import { useQuery } from '@tanstack/react-query';
import { listVenues } from '../api/venues.api';

export function useListVenues(organizationId: string, devUserId: string) {
  return useQuery({
    queryKey: ['venues', organizationId],
    queryFn: () => listVenues(organizationId, devUserId),
  });
}
