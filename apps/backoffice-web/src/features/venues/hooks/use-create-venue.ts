'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createVenue } from '../api/venues.api';
import type { CreateVenueInput } from '../types';

export function useCreateVenue(organizationId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVenueInput) => createVenue(organizationId, input, token ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['venues', organizationId] });
    },
  });
}
