'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTicketType } from '../api/ticket-types.api';
import type { CreateTicketTypeInput } from '../types';

export function useCreateTicketType(
  organizationId: string,
  eventId: string,
  devUserId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateTicketTypeInput;
      idempotencyKey: string;
    }) => createTicketType(organizationId, eventId, input, idempotencyKey, devUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-types', organizationId, eventId] });
    },
  });
}
