'use client';

import { useEffect, useMemo, useState } from 'react';

function remainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(() => expiresAt ? remainingSeconds(expiresAt) : 0);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setRemaining(remainingSeconds(expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return useMemo(() => {
    const expired = expiresAt === null ? false : new Date(expiresAt).getTime() <= Date.now();
    return { remaining, expired };
  }, [expiresAt, remaining]);
}

export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
