'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createEvent } from '../api/events.api';
import type { CreateEventInput } from '../types';

export function useCreateEvent(organizationId: string) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(organizationId, input, token ?? ''),
  });
}
