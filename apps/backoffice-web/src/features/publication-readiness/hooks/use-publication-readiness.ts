'use client';

import { useQuery } from '@tanstack/react-query';
import { getPublicationReadiness } from '../api/readiness.api';

export const publicationReadinessKey = (organizationId: string, eventId: string) =>
  ['publication-readiness', organizationId, eventId] as const;

export function usePublicationReadiness(
  organizationId: string,
  eventId: string,
  devUserId: string,
) {
  return useQuery({
    queryKey: publicationReadinessKey(organizationId, eventId),
    queryFn: () => getPublicationReadiness(organizationId, eventId, devUserId),
    enabled: Boolean(organizationId && eventId && devUserId),
  });
}
