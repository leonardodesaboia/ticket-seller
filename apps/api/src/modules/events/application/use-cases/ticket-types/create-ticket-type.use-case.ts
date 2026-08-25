import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { CREATE_TICKET_TYPE_OPERATION_PORT } from '../../ports/create-ticket-type-operation.port';
import type {
  CreateTicketTypeOperationResult,
  ICreateTicketTypeOperationPort,
} from '../../ports/create-ticket-type-operation.port';
import {
  EventNotFoundError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../../domain/event.errors';
import {
  EVENT_REPOSITORY,
  type IEventRepository,
} from '../../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../../domain/ports/organization-access.port';

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
    actorId: command.actorId,
    organizationId: command.organizationId,
    eventId: command.eventId,
    name: command.name,
    description: command.description,
    priceAmount: command.priceAmount,
    capacity: command.capacity,
  });
  return createHash('sha256').update(payload).digest('hex');
}

@Injectable()
export class CreateTicketTypeUseCase {
  constructor(
    @Inject(CREATE_TICKET_TYPE_OPERATION_PORT)
    private readonly createOperation: ICreateTicketTypeOperationPort,
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: CreateTicketTypeCommand): Promise<CreateTicketTypeOperationResult> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);
    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }
    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    const event = await this.eventRepository.findByOrganizationAndId(
      command.organizationId,
      command.eventId,
    );
    if (!event) throw new EventNotFoundError();

    return this.createOperation.execute({
      scopedKey: `ticket-type-create:${command.organizationId}:${command.eventId}:${command.idempotencyKey}`,
      requestHash: hashRequest(command),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ticketType: {
        id: randomUUID(),
        eventId: command.eventId,
        organizationId: command.organizationId,
        name: command.name,
        description: command.description,
        priceAmount: command.priceAmount,
        capacity: command.capacity,
      },
    });
  }
}
