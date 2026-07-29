'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTicketType } from '../api/ticket-types.api';
import type { UpdateTicketTypeInput } from '../types';

export function useUpdateTicketType(
  organizationId: string,
  eventId: string,
  ticketTypeId: string,
  devUserId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketTypeInput) =>
      updateTicketType(organizationId, eventId, ticketTypeId, input, devUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-types', organizationId, eventId] });
    },
  });
}
