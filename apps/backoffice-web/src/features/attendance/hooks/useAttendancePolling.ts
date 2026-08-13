'use client';

import { useState, useEffect } from 'react';
import { getEventAttendance, AttendanceResponse } from '@/shared/api/attendance.api';

const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';
const POLL_INTERVAL_MS = 15_000;

export function useAttendancePolling(orgId: string, eventId: string) {
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await getEventAttendance(orgId, eventId, DEV_USER_ID);
        setData(result);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    };

    void load();
    intervalId = setInterval(() => void load(), POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [orgId, eventId]);

  return { data, error };
}
