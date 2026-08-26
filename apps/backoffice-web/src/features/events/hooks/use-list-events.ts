'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { listEvents } from '../api/events.api';
import type { Event } from '../types';

const PAGE_SIZE = 20;

export function useListEvents(organizationId: string) {
  const { token } = useAuth();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allEvents, setAllEvents] = useState<Event[]>([]);

  const query = useQuery({
    queryKey: ['events', organizationId, cursor],
    queryFn: async () => {
      const result = await listEvents(
        organizationId,
        { ...(cursor !== undefined && { cursor }), limit: PAGE_SIZE },
        token ?? '',
      );
      if (cursor === undefined) {
        setAllEvents(result.data);
      } else {
        setAllEvents((prev) => [...prev, ...result.data]);
      }
      return result;
    },
    enabled: Boolean(organizationId && token),
  });

  function loadMore() {
    if (query.data?.nextCursor) {
      setCursor(query.data.nextCursor);
    }
  }

  function reset() {
    setAllEvents([]);
    setCursor(undefined);
  }

  return {
    events: allEvents,
    nextCursor: query.data?.nextCursor ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    loadMore,
    reset,
  };
}
