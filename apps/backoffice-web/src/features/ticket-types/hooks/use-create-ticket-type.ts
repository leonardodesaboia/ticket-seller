'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createTicketType } from '../api/ticket-types.api';
import type { CreateTicketTypeInput } from '../types';

export function useCreateTicketType(
  organizationId: string,
  eventId: string,
) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateTicketTypeInput;
      idempotencyKey: string;
    }) => createTicketType(organizationId, eventId, input, idempotencyKey, token ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-types', organizationId, eventId] });
    },
  });
}
