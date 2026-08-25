'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getLatestPaymentAttempt, type AttemptStatus, type PaymentAttemptResponse } from '@/shared/api/public-payments.api';
import { PublicApiError } from '@/shared/api/public-reservations.api';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes

const TERMINAL_STATUSES: AttemptStatus[] = ['APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED'];

interface UsePaymentPollingOptions {
  orderId: string;
  token: string;
  onUpdate: (attempt: PaymentAttemptResponse) => void;
  onTimeout: () => void;
}

export function usePaymentPolling({ orderId, token, onUpdate, onTimeout }: UsePaymentPollingOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;
    if (document.visibilityState === 'hidden') {
      timerRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
      return;
    }
    try {
      const attempt = await getLatestPaymentAttempt(orderId, token);
      if (!activeRef.current) return;
      if (attempt) {
        onUpdate(attempt);
        if (TERMINAL_STATUSES.includes(attempt.status)) {
          clearTimers();
          return;
        }
      }
    } catch (err) {
      // Permanent errors (auth, not found, gone): stop polling immediately
      if (err instanceof PublicApiError && [401, 403, 404, 410].includes(err.status)) {
        clearTimers();
        activeRef.current = false;
        onTimeout();
        return;
      }
      // Transient network errors: continue retrying on next tick
    }
    if (activeRef.current) {
      timerRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    }
  }, [orderId, token, onUpdate, clearTimers]);

  useEffect(() => {
    activeRef.current = true;

    timeoutRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      clearTimers();
      activeRef.current = false;
      onTimeout();
    }, POLL_TIMEOUT_MS);

    timerRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => { void poll(); }, 0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activeRef.current = false;
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll, clearTimers, onTimeout]);
}
