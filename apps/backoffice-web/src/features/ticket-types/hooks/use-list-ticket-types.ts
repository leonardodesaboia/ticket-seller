'use client';

import { useQuery } from '@tanstack/react-query';
import { listTicketTypes } from '../api/ticket-types.api';

export function useListTicketTypes(
  organizationId: string,
  eventId: string,
  devUserId: string,
) {
  return useQuery({
    queryKey: ['ticket-types', organizationId, eventId],
    queryFn: () => listTicketTypes(organizationId, eventId, devUserId),
    select: (data) => data.data,
  });
}
