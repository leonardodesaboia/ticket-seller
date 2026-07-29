'use client';

import { useMutation } from '@tanstack/react-query';
import { updateEventConfiguration } from '../api/events.api';
import type { UpdateEventConfigurationInput } from '../types';

export function useUpdateEventConfiguration(
  organizationId: string,
  eventId: string,
  devUserId: string,
) {
  return useMutation({
    mutationFn: (input: UpdateEventConfigurationInput) =>
      updateEventConfiguration(organizationId, eventId, input, devUserId),
  });
}
