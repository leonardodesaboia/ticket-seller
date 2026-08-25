'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listTransactions } from '../api/finance.api';
import type { LedgerTransactionItem } from '../types';

const PAGE_SIZE = 20;

export function useTransactions(organizationId: string, devUserId: string) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<LedgerTransactionItem[]>([]);

  const query = useQuery({
    queryKey: ['finance', 'transactions', organizationId, cursor],
    queryFn: () =>
      listTransactions(
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
    transactions: allItems,
    nextCursor: query.data?.nextCursor ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    loadMore,
    reset,
  };
}
