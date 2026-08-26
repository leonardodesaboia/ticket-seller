'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { updateTicketType } from '../api/ticket-types.api';
import type { UpdateTicketTypeInput } from '../types';

export function useUpdateTicketType(
  organizationId: string,
  eventId: string,
  ticketTypeId: string,
) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketTypeInput) =>
      updateTicketType(organizationId, eventId, ticketTypeId, input, token ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-types', organizationId, eventId] });
    },
  });
}
