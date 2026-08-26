'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { updateEventConfiguration } from '../api/events.api';
import type { UpdateEventConfigurationInput } from '../types';

export function useUpdateEventConfiguration(
  organizationId: string,
  eventId: string,
) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateEventConfigurationInput) =>
      updateEventConfiguration(organizationId, eventId, input, token ?? ''),
  });
}
