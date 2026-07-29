'use client';

import { useQuery } from '@tanstack/react-query';
import { getEvent } from '../api/events.api';

export function useGetEvent(organizationId: string, eventId: string, devUserId: string) {
  return useQuery({
    queryKey: ['event', organizationId, eventId],
    queryFn: () => getEvent(organizationId, eventId, devUserId),
    enabled: Boolean(organizationId && eventId && devUserId),
  });
}
