'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listPayouts } from '../api/finance.api';
import type { PayoutItem } from '../types';

const PAGE_SIZE = 20;

export function usePayouts(organizationId: string, devUserId: string) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<PayoutItem[]>([]);

  const query = useQuery({
    queryKey: ['finance', 'payouts', organizationId, cursor],
    queryFn: () =>
      listPayouts(
        organizationId,
        { ...(cursor !== undefined && { cursor }), limit: PAGE_SIZE },
        devUserId,
      ),
    enabled: Boolean(organizationId && devUserId),
  });

  useEffect(() => {
    if (!query.data) return;
    if (cursor === undefined) {
      setAllItems(query.data.data);
    } else {
      setAllItems((prev) => [...prev, ...query.data!.data]);
    }
  }, [query.data]);

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
