'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPayout } from '../api/finance.api';

export function useCreatePayout(organizationId: string, devUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { amount: number; currency: string; idempotencyKey: string }) =>
      createPayout(organizationId, body, devUserId),
    onSuccess: () => {
      // Invalidate balance and payouts list after a successful payout
      void queryClient.invalidateQueries({ queryKey: ['finance', 'balance', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['finance', 'payouts', organizationId] });
    },
  });
}
