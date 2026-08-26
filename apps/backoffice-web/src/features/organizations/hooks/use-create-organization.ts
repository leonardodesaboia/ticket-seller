'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createOrganization } from '../api/organizations.api';
import type { CreateOrganizationInput } from '../types';

export function useCreateOrganization() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => createOrganization(input, token ?? ''),
  });
}
