import { API_BASE_URL } from '@/shared/api/api-client';

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

function extractDetail(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    return String((body as { detail: unknown }).detail);
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    return String((body as { message: unknown }).message);
  }
  return fallback;
}

function adminBase(): string {
  return `${API_BASE_URL}/admin`;
}

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface PlatformDashboard {
  totalOrganizations: number;
  totalUsers: number;
  totalEvents: number;
  activeOrders: number;
  pendingPayouts: number;
  processingPayouts: number;
  suspendedOrganizations: number;
}

export interface AdminOrganizationItem {
  id: string;
  name: string;
  suspendedAt: string | null;
  createdAt: string;
  memberCount: number;
  eventCount: number;
}

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string | null;
  platformRole: string | null;
  suspendedAt: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export async function getDashboard(token: string): Promise<PlatformDashboard> {
  const res = await fetch(`${adminBase()}/dashboard`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao buscar dashboard'), body);
  return body as PlatformDashboard;
}

export async function listAdminOrganizations(
  params: { cursor?: string; limit?: number },
  token: string,
): Promise<PaginatedResult<AdminOrganizationItem>> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${adminBase()}/organizations${query}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao listar organizações'), body);
  return body as PaginatedResult<AdminOrganizationItem>;
}

export async function listAdminUsers(
  params: { cursor?: string; limit?: number },
  token: string,
): Promise<PaginatedResult<AdminUserItem>> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${adminBase()}/users${query}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao listar usuários'), body);
  return body as PaginatedResult<AdminUserItem>;
}

export async function suspendOrganization(
  orgId: string,
  reason: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${adminBase()}/organizations/${orgId}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao suspender organização'), body);
}

export async function unsuspendOrganization(
  orgId: string,
  reason: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${adminBase()}/organizations/${orgId}/unsuspend`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao reativar organização'), body);
}

export async function suspendUser(
  userId: string,
  reason: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${adminBase()}/users/${userId}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao suspender usuário'), body);
}

export async function unsuspendUser(
  userId: string,
  reason: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${adminBase()}/users/${userId}/unsuspend`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao reativar usuário'), body);
}

export async function blockPayout(
  payoutId: string,
  reason: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${adminBase()}/payouts/${payoutId}/block`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao bloquear payout'), body);
}
