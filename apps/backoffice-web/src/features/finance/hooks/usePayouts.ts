'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listPayouts } from '../api/finance.api';
import type { PayoutItem } from '../types';

const PAGE_SIZE = 20;

export function usePayouts(organizationId: string, devUserId: string) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<PayoutItem[]>([]);

  const query = useQuery({
    queryKey: ['finance', 'payouts', organizationId, cursor],
    queryFn: async () => {
      const result = await listPayouts(
        organizationId,
        { ...(cursor !== undefined && { cursor }), limit: PAGE_SIZE },
        devUserId,
      );
      if (cursor === undefined) {
        setAllItems(result.data);
      } else {
        setAllItems((prev) => [...prev, ...result.data]);
      }
      return result;
    },
    enabled: Boolean(organizationId && devUserId),
  });

  function loadMore() {
    if (query.data?.nextCursor) {
      setCursor(query.data.nextCursor);
    }
  }

  function reset() {
    setAllItems([]);
    setCursor(undefined);
  }

  return {
    payouts: allItems,
    nextCursor: query.data?.nextCursor ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    loadMore,
    reset,
  };
}
