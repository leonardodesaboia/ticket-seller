'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createPayout } from '../api/finance.api';

export function useCreatePayout(organizationId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { amount: number; currency: string; idempotencyKey: string }) =>
      createPayout(organizationId, body, token ?? ''),
    onSuccess: () => {
      // Invalidate balance and payouts list after a successful payout
      void queryClient.invalidateQueries({ queryKey: ['finance', 'balance', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['finance', 'payouts', organizationId] });
    },
  });
}
