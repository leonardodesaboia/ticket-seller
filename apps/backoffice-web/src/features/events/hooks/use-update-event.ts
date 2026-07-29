'use client';

import { useMutation } from '@tanstack/react-query';
import { updateEvent } from '../api/events.api';
import type { UpdateEventInput } from '../types';

export function useUpdateEvent(organizationId: string, eventId: string, devUserId: string) {
  return useMutation({
    mutationFn: (input: UpdateEventInput) => updateEvent(organizationId, eventId, input, devUserId),
  });
}
