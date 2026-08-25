import { Injectable } from '@nestjs/common';
import type { TicketType as PrismaTicketType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IdempotencyKeyConflictError } from '../../application/errors/idempotency-key-conflict.error';
import type {
  CreateTicketTypeOperationInput,
  CreateTicketTypeOperationResult,
  ICreateTicketTypeOperationPort,
} from '../../application/ports/create-ticket-type-operation.port';
import { EventNotFoundError, EventNotInDraftError } from '../../domain/event.errors';
import { TicketType } from '../../domain/ticket-types/ticket-type.entity';
import { EventCurrencyNotSetError } from '../../domain/ticket-types/ticket-type.errors';

interface CachedTicketType {
  id: string;
  eventId: string;
  organizationId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  capacity: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * True only for a unique-constraint violation on the idempotency key. Other
 * P2002 violations (e.g. ticket_type name uniqueness) must propagate instead of
 * being misread as an idempotency replay.
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const serialized = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return serialized.toLowerCase().includes('idempotency');
}

function parseCachedTicketType(value: unknown): CachedTicketType | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record['id'] !== 'string' ||
    typeof record['eventId'] !== 'string' ||
    typeof record['organizationId'] !== 'string' ||
    typeof record['name'] !== 'string' ||
    !(typeof record['description'] === 'string' || record['description'] === null) ||
    typeof record['priceAmount'] !== 'number' ||
    typeof record['capacity'] !== 'number' ||
    typeof record['status'] !== 'string' ||
    typeof record['version'] !== 'number' ||
    typeof record['createdAt'] !== 'string' ||
    typeof record['updatedAt'] !== 'string'
  ) {
    return null;
  }
  return {
    id: record['id'],
    eventId: record['eventId'],
    organizationId: record['organizationId'],
    name: record['name'],
    description: record['description'],
    priceAmount: record['priceAmount'],
    capacity: record['capacity'],
    status: record['status'],
    version: record['version'],
    createdAt: record['createdAt'],
    updatedAt: record['updatedAt'],
  };
}

@Injectable()
export class PrismaCreateTicketTypeOperationAdapter implements ICreateTicketTypeOperationPort {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateTicketTypeOperationInput): Promise<CreateTicketTypeOperationResult> {
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

          const lockedEvents = await tx.$queryRaw<
            Array<{ status: string; currency: string | null }>
          >`
            SELECT status, currency
            FROM events
            WHERE id = ${input.ticketType.eventId}::uuid
              AND organization_id = ${input.ticketType.organizationId}::uuid
            FOR UPDATE
          `;
          const lockedEvent = lockedEvents[0];
          if (!lockedEvent) throw new EventNotFoundError();
          if (lockedEvent.status !== 'DRAFT') throw new EventNotInDraftError();
          if (!lockedEvent.currency) throw new EventCurrencyNotSetError();

          const row = await tx.ticketType.create({
            data: input.ticketType,
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'ticket-type',
              aggregateId: row.id,
              type: 'ticket-type.created.v1',
              version: '1',
              organizationId: row.organizationId,
              payload: {
                ticketTypeId: row.id,
                eventId: row.eventId,
                organizationId: row.organizationId,
                name: row.name,
                priceAmount: row.priceAmount,
                capacity: row.capacity,
              },
            },
          });

          const responseBody = this.toCachedResponse(row);
          await tx.idempotencyRecord.update({
            where: { idempotencyKey: input.scopedKey },
            data: {
              responseStatus: 201,
              responseBody: { ...responseBody },
              completedAt: new Date(),
            },
          });

          return { ticketType: this.toEntity(row), cached: false };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.resolveExisting(input);
    }
  }

  private async resolveExisting(
    input: CreateTicketTypeOperationInput,
  ): Promise<CreateTicketTypeOperationResult> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey: input.scopedKey },
    });
    if (!existing) {
      throw new IdempotencyKeyConflictError('Idempotency operation could not be resolved');
    }
    if (existing.requestHash !== input.requestHash) {
      throw new IdempotencyKeyConflictError();
    }

    const cached = parseCachedTicketType(existing.responseBody);
    if (!existing.completedAt || !cached) {
      throw new IdempotencyKeyConflictError('Idempotency operation is still in progress');
    }

    return {
      ticketType: new TicketType(
        cached.id,
        cached.eventId,
        cached.organizationId,
        cached.name,
        cached.description,
        cached.priceAmount,
        cached.capacity,
        cached.status,
        cached.version,
        new Date(cached.createdAt),
        new Date(cached.updatedAt),
      ),
      cached: true,
    };
  }

  private toCachedResponse(row: PrismaTicketType): CachedTicketType {
    return {
      id: row.id,
      eventId: row.eventId,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      priceAmount: row.priceAmount,
      capacity: row.capacity,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEntity(row: PrismaTicketType): TicketType {
    return new TicketType(
      row.id,
      row.eventId,
      row.organizationId,
      row.name,
      row.description,
      row.priceAmount,
      row.capacity,
      row.status,
      row.version,
      row.createdAt,
      row.updatedAt,
    );
  }
}
