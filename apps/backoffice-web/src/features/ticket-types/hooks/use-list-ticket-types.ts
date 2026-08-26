'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { listTicketTypes } from '../api/ticket-types.api';

export function useListTicketTypes(
  organizationId: string,
  eventId: string,
) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['ticket-types', organizationId, eventId],
    queryFn: () => listTicketTypes(organizationId, eventId, token ?? ''),
    select: (data) => data.data,
    enabled: Boolean(organizationId && eventId && token),
  });
}
