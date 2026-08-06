import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IdempotencyKeyConflictError } from '../../application/errors/idempotency-key-conflict.error';
import type {
  IPublishEventOperationPort,
  PublishEventOperationInput,
  PublishEventOperationResult,
  PublishedEventData,
} from '../../application/ports/publish-event-operation.port';
import {
  EventNotDraftError,
  EventNotFoundError,
  EventPublicationNotReadyError,
  EventVersionConflictError,
} from '../../domain/event.errors';
import {
  PublicationReadinessPolicy,
  type PublicationReadinessSnapshot,
} from '../../domain/publication/publication-readiness.policy';
import { buildEventSlug } from '../../domain/publication/slug';

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * True only for a unique-constraint violation on the idempotency key. Other
 * P2002 violations (e.g. the global `events.slug` unique index) must propagate
 * instead of being misread as an idempotency replay.
 */
function isIdempotencyKeyUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const serialized = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return serialized.toLowerCase().includes('idempotency');
}

function parseCachedEvent(value: unknown): PublishedEventData | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const isStringOrNull = (key: string): boolean =>
    typeof record[key] === 'string' || record[key] === null;
  if (
    typeof record['id'] !== 'string' ||
    typeof record['organizationId'] !== 'string' ||
    typeof record['title'] !== 'string' ||
    !isStringOrNull('description') ||
    typeof record['status'] !== 'string' ||
    typeof record['version'] !== 'number' ||
    !isStringOrNull('format') ||
    !isStringOrNull('startsAt') ||
    !isStringOrNull('endsAt') ||
    !isStringOrNull('timezone') ||
    !isStringOrNull('venueId') ||
    !isStringOrNull('currency') ||
    typeof record['onlineConfigured'] !== 'boolean' ||
    !isStringOrNull('slug') ||
    !isStringOrNull('publishedAt') ||
    typeof record['createdAt'] !== 'string' ||
    typeof record['updatedAt'] !== 'string'
  ) {
    return null;
  }
  return {
    id: record['id'],
    organizationId: record['organizationId'],
    title: record['title'],
    description: record['description'] as string | null,
    status: record['status'],
    version: record['version'],
    format: record['format'] as string | null,
    startsAt: record['startsAt'] as string | null,
    endsAt: record['endsAt'] as string | null,
    timezone: record['timezone'] as string | null,
    venueId: record['venueId'] as string | null,
    currency: record['currency'] as string | null,
    onlineConfigured: record['onlineConfigured'],
    slug: record['slug'] as string | null,
    publishedAt: record['publishedAt'] as string | null,
    createdAt: record['createdAt'],
    updatedAt: record['updatedAt'],
  };
}

@Injectable()
export class PrismaPublishEventOperationAdapter implements IPublishEventOperationPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PublicationReadinessPolicy,
  ) {}

  async execute(input: PublishEventOperationInput): Promise<PublishEventOperationResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.idempotencyRecord.create({
            data: {
              id: randomUUID(),
              idempotencyKey: input.scopedKey,
              requestHash: input.requestHash,
              expiresAt: input.expiresAt,
            },
          });

          // Lock the event row (tenant-scoped) so concurrent publish/edit
          // requests observe a deterministic order.
          const lockedEvents = await tx.$queryRaw<Array<{ status: string; version: number }>>`
            SELECT status, version
            FROM events
            WHERE id = ${input.eventId}::uuid
              AND organization_id = ${input.organizationId}::uuid
            FOR UPDATE
          `;
          const lockedEvent = lockedEvents[0];
          if (!lockedEvent) throw new EventNotFoundError();
          if (lockedEvent.status !== 'DRAFT') throw new EventNotDraftError();
          if (lockedEvent.version !== input.expectedVersion) {
            throw new EventVersionConflictError();
          }

          const snapshot = await this.buildSnapshot(tx, input.organizationId, input.eventId);
          if (!snapshot) throw new EventNotFoundError();

          const readiness = this.policy.evaluate(snapshot, input.now);
          if (!readiness.ready) {
            throw new EventPublicationNotReadyError(readiness.version, readiness.issues);
          }

          const slug = buildEventSlug(snapshot.event.title, input.eventId);
          const result = await tx.event.updateMany({
            where: {
              id: input.eventId,
              organizationId: input.organizationId,
              version: input.expectedVersion,
              status: 'DRAFT',
            },
            data: {
              status: 'PUBLISHED',
              version: { increment: 1 },
              slug,
              publishedAt: input.now,
            },
          });
          if (result.count === 0) throw new EventVersionConflictError();

          const updated = await tx.event.findFirst({
            where: { id: input.eventId, organizationId: input.organizationId },
          });
          if (!updated) throw new EventNotFoundError();

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'event',
              aggregateId: updated.id,
              type: 'event.published.v1',
              version: '1',
              organizationId: updated.organizationId,
              payload: {
                eventId: updated.id,
                organizationId: updated.organizationId,
                version: updated.version,
                slug: updated.slug,
                publishedAt: updated.publishedAt?.toISOString() ?? null,
                startsAt: updated.startsAt?.toISOString() ?? null,
              },
            },
          });

          await tx.auditEntry.create({
            data: {
              organizationId: updated.organizationId,
              userId: input.actorId,
              action: 'event.published',
              resourceType: 'event',
              resourceId: updated.id,
              metadata: {
                version: updated.version,
                slug: updated.slug,
                publishedAt: updated.publishedAt?.toISOString() ?? null,
              },
            },
          });

          const responseBody = this.toResponse(updated);
          await tx.idempotencyRecord.update({
            where: { idempotencyKey: input.scopedKey },
            data: {
              responseStatus: 200,
              responseBody: { ...responseBody },
              completedAt: new Date(),
            },
          });

          return { event: responseBody, cached: false };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!isIdempotencyKeyUniqueViolation(error)) throw error;
      return this.resolveExisting(input);
    }
  }

  private async buildSnapshot(
    tx: TransactionClient,
    organizationId: string,
    eventId: string,
  ): Promise<PublicationReadinessSnapshot | null> {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
        version: true,
        format: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        onlineInfo: true,
        venueId: true,
        currency: true,
        organization: { select: { status: true } },
        venue: { select: { id: true, organizationId: true } },
        ticketTypes: {
          select: { id: true, name: true, priceAmount: true, capacity: true, status: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!event) return null;

    return {
      organizationStatus: event.organization.status,
      event: {
        id: event.id,
        organizationId: event.organizationId,
        title: event.title,
        status: event.status,
        version: event.version,
        format: event.format,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        onlineConfigured: event.onlineInfo !== null && event.onlineInfo.trim().length > 0,
        venueId: event.venueId,
        currency: event.currency,
      },
      venue: event.venue,
      ticketTypes: event.ticketTypes,
    };
  }

  private async resolveExisting(
    input: PublishEventOperationInput,
  ): Promise<PublishEventOperationResult> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey: input.scopedKey },
    });
    if (!existing) {
      throw new IdempotencyKeyConflictError('Idempotency operation could not be resolved');
    }
    if (existing.requestHash !== input.requestHash) {
      throw new IdempotencyKeyConflictError();
    }

    const cached = parseCachedEvent(existing.responseBody);
    if (!existing.completedAt || !cached) {
      throw new IdempotencyKeyConflictError('Idempotency operation is still in progress');
    }

    return { event: cached, cached: true };
  }

  private toResponse(row: {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    status: string;
    version: number;
    format: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    timezone: string | null;
    onlineInfo: string | null;
    venueId: string | null;
    currency: string | null;
    slug: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PublishedEventData {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      description: row.description,
      status: row.status,
      version: row.version,
      format: row.format,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      timezone: row.timezone,
      venueId: row.venueId,
      currency: row.currency,
      onlineConfigured: row.onlineInfo !== null && row.onlineInfo.trim().length > 0,
      slug: row.slug,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
