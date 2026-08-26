'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { updateEvent } from '../api/events.api';
import type { UpdateEventInput } from '../types';

export function useUpdateEvent(organizationId: string, eventId: string) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => updateEvent(organizationId, eventId, input, token ?? ''),
  });
}
