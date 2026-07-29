import { API_BASE_URL } from '@/shared/api/api-client';
import type { CreateOrganizationInput, Organization } from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function createOrganization(
  input: CreateOrganizationInput,
  devUserId: string,
): Promise<Organization> {
  const res = await fetch(`${API_BASE_URL}/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-User-Id': devUserId,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : 'Erro ao criar organização';
    throw new ApiError(res.status, detail, body);
  }

  return body as Organization;
}
