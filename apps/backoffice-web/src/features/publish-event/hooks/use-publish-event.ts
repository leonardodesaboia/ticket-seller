'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { publishEvent } from '../api/publish.api';
import { publicationReadinessKey } from '@/features/publication-readiness';

export function usePublishEvent(organizationId: string, eventId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ version, idempotencyKey }: { version: number; idempotencyKey: string }) =>
      publishEvent(organizationId, eventId, version, idempotencyKey, token ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', organizationId, eventId] });
      void queryClient.invalidateQueries({
        queryKey: publicationReadinessKey(organizationId, eventId),
      });
    },
  });
}
