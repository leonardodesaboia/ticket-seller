'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getEvent } from '../api/events.api';

export function useGetEvent(organizationId: string, eventId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['event', organizationId, eventId],
    queryFn: () => getEvent(organizationId, eventId, token ?? ''),
    enabled: Boolean(organizationId && eventId && token),
  });
}
