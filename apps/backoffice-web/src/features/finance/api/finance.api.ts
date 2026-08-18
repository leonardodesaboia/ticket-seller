import { API_BASE_URL } from '@/shared/api/api-client';
import type {
  BalanceResponse,
  FinancialSummary,
  ListTransactionsResponse,
  ListPayoutsResponse,
  CreatePayoutResponse,
} from '../types';

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

function orgBase(organizationId: string): string {
  return `${API_BASE_URL}/organizations/${organizationId}/finance`;
}

export async function getBalance(
  organizationId: string,
  devUserId: string,
): Promise<BalanceResponse> {
  const res = await fetch(`${orgBase(organizationId)}/balance`, {
    headers: { 'X-Dev-User-Id': devUserId },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao buscar saldo'), body);
  return body as BalanceResponse;
}

export async function getFinancialSummary(
  organizationId: string,
  from: string,
  to: string,
  devUserId: string,
): Promise<FinancialSummary> {
  const qs = new URLSearchParams({ from, to });
  const res = await fetch(`${orgBase(organizationId)}/summary?${qs.toString()}`, {
    headers: { 'X-Dev-User-Id': devUserId },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractDetail(body, 'Erro ao buscar resumo'), body);
  return body as FinancialSummary;
}

export async function listTransactions(
  organizationId: string,
  params: { cursor?: string; limit?: number },
  devUserId: string,
): Promise<ListTransactionsResponse> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${orgBase(organizationId)}/transactions${query}`, {
    headers: { 'X-Dev-User-Id': devUserId },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar transações'), body);
  return body as ListTransactionsResponse;
}

export async function listPayouts(
  organizationId: string,
  params: { cursor?: string; limit?: number },
  devUserId: string,
): Promise<ListPayoutsResponse> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${orgBase(organizationId)}/payouts${query}`, {
    headers: { 'X-Dev-User-Id': devUserId },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(res.status, extractDetail(body, 'Erro ao listar payouts'), body);
  return body as ListPayoutsResponse;
}

export async function createPayout(
  organizationId: string,
  body: { amount: number; currency: string; idempotencyKey: string },
  devUserId: string,
): Promise<CreatePayoutResponse> {
  const res = await fetch(`${orgBase(organizationId)}/payouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-User-Id': devUserId,
    },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(res.status, extractDetail(resBody, 'Erro ao criar payout'), resBody);
  return resBody as CreatePayoutResponse;
}
