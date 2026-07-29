import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../../platform/database/prisma.service';
import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';
import { EventCurrencyNotSetError } from '../../../domain/ticket-types/ticket-type.errors';
import {
  ITicketTypeRepository,
  TICKET_TYPE_REPOSITORY,
} from '../../../domain/ticket-types/ticket-type-repository.port';
import {
  EVENT_REPOSITORY,
  type IEventRepository,
} from '../../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../../domain/ports/organization-access.port';
import {
  EventNotFoundError,
  EventNotInDraftError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../../domain/event.errors';

export interface CreateTicketTypeCommand {
  organizationId: string;
  eventId: string;
  actorId: string;
  idempotencyKey: string;
  name: string;
  description: string | null;
  priceAmount: number;
  capacity: number;
}

function hashRequest(command: CreateTicketTypeCommand): string {
  const payload = JSON.stringify({
    eventId: command.eventId,
    name: command.name,
    priceAmount: command.priceAmount,
    capacity: command.capacity,
  });
  return createHash('sha256').update(payload).digest('hex');
}

@Injectable()
export class CreateTicketTypeUseCase {
  constructor(
    @Inject(TICKET_TYPE_REPOSITORY) private readonly ticketTypeRepository: ITicketTypeRepository,
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateTicketTypeCommand): Promise<{ ticketType: TicketType; cached: boolean }> {
    const scopedKey = `ticket-type-create:${command.organizationId}:${command.eventId}:${command.idempotencyKey}`;

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey: scopedKey },
    });

    if (existing?.completedAt && existing.responseBody) {
      const cached = existing.responseBody as {
        id: string; eventId: string; organizationId: string; name: string;
        description: string | null; priceAmount: number; capacity: number;
        status: string; version: number; createdAt: string; updatedAt: string;
      };
      return {
        ticketType: new (await import('../../../domain/ticket-types/ticket-type.entity')).TicketType(
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

    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);
    if (!member || member.status !== 'ACTIVE') throw new OrganizationAccessDeniedError();
    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) throw new InsufficientRoleError();

    const event = await this.eventRepository.findByOrganizationAndId(
      command.organizationId,
      command.eventId,
    );
    if (!event) throw new EventNotFoundError();
    if (event.status !== 'DRAFT') throw new EventNotInDraftError();
    if (!event.currency) throw new EventCurrencyNotSetError();

    const requestHash = hashRequest(command);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const idempotencyId = randomUUID();
    await this.prisma.idempotencyRecord.upsert({
      where: { idempotencyKey: scopedKey },
      update: {},
      create: { id: idempotencyId, idempotencyKey: scopedKey, requestHash, expiresAt },
    });

    const ticketType = await this.ticketTypeRepository.create({
      id: randomUUID(),
      eventId: command.eventId,
      organizationId: command.organizationId,
      name: command.name,
      description: command.description,
      priceAmount: command.priceAmount,
      capacity: command.capacity,
    });

    await this.prisma.idempotencyRecord.update({
      where: { idempotencyKey: scopedKey },
      data: {
        responseStatus: 201,
        responseBody: {
          id: ticketType.id,
          eventId: ticketType.eventId,
          organizationId: ticketType.organizationId,
          name: ticketType.name,
          description: ticketType.description,
          priceAmount: ticketType.priceAmount,
          capacity: ticketType.capacity,
          status: ticketType.status,
          version: ticketType.version,
          createdAt: ticketType.createdAt.toISOString(),
          updatedAt: ticketType.updatedAt.toISOString(),
        },
        completedAt: new Date(),
      },
    });

    return { ticketType, cached: false };
  }
}
