'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publishEvent } from '../api/publish.api';
import { publicationReadinessKey } from '@/features/publication-readiness';

export function usePublishEvent(organizationId: string, eventId: string, devUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ version, idempotencyKey }: { version: number; idempotencyKey: string }) =>
      publishEvent(organizationId, eventId, version, idempotencyKey, devUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', organizationId, eventId] });
      void queryClient.invalidateQueries({
        queryKey: publicationReadinessKey(organizationId, eventId),
      });
    },
  });
}
