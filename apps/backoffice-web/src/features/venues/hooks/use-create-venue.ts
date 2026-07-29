'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVenue } from '../api/venues.api';
import type { CreateVenueInput } from '../types';

export function useCreateVenue(organizationId: string, devUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVenueInput) => createVenue(organizationId, input, devUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['venues', organizationId] });
    },
  });
}
