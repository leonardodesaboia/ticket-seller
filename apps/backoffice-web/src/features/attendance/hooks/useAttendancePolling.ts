'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { getEventAttendance, AttendanceResponse } from '@/shared/api/attendance.api';

const POLL_INTERVAL_MS = 15_000;

export function useAttendancePolling(orgId: string, eventId: string) {
  const { token } = useAuth();
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!token) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await getEventAttendance(orgId, eventId, token);
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
  }, [orgId, eventId, token]);

  return { data, error };
}
