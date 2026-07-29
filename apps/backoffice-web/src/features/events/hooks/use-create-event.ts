'use client';

import { useMutation } from '@tanstack/react-query';
import { createEvent } from '../api/events.api';
import type { CreateEventInput } from '../types';

export function useCreateEvent(organizationId: string, devUserId: string) {
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(organizationId, input, devUserId),
  });
}
