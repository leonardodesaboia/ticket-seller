'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getPublicationReadiness } from '../api/readiness.api';

export const publicationReadinessKey = (organizationId: string, eventId: string) =>
  ['publication-readiness', organizationId, eventId] as const;

export function usePublicationReadiness(
  organizationId: string,
  eventId: string,
) {
  const { token } = useAuth();
  return useQuery({
    queryKey: publicationReadinessKey(organizationId, eventId),
    queryFn: () => getPublicationReadiness(organizationId, eventId, token ?? ''),
    enabled: Boolean(organizationId && eventId && token),
  });
}
