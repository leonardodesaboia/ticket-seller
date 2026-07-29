'use client';

import { useMutation } from '@tanstack/react-query';
import { createOrganization } from '../api/organizations.api';
import type { CreateOrganizationInput } from '../types';

export function useCreateOrganization(devUserId: string) {
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => createOrganization(input, devUserId),
  });
}
