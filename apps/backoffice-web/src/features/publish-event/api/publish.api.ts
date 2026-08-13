import { API_BASE_URL } from '@/shared/api/api-client';
import type { Event } from '@/features/events/types';
import type { ReadinessIssue } from '@/features/publication-readiness/types';

export class PublishError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string | null,
    public readonly version: number | null,
    public readonly issues: ReadinessIssue[] | null,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

function readString(body: Record<string, unknown>, key: string): string | null {
  return typeof body[key] === 'string' ? (body[key] as string) : null;
}

export async function publishEvent(
  organizationId: string,
  eventId: string,
  version: number,
  idempotencyKey: string,
  devUserId: string,
): Promise<Event> {
  const res = await fetch(
    `${API_BASE_URL}/organizations/${organizationId}/events/${eventId}/publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Dev-User-Id': devUserId,
      },
      body: JSON.stringify({ version }),
    },
  );

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new PublishError(
      res.status,
      readString(body, 'detail') ?? 'Erro ao publicar o evento',
      readString(body, 'code'),
      typeof body['version'] === 'number' ? (body['version'] as number) : null,
      Array.isArray(body['issues']) ? (body['issues'] as ReadinessIssue[]) : null,
    );
  }

  return body as unknown as Event;
}
