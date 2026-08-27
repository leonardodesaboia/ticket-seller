import { createHash, randomUUID } from 'crypto';
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
  type IEventRepository,
} from '../../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
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

export class CreateTicketTypeUseCase {
  constructor(
    private readonly createOperation: ICreateTicketTypeOperationPort,
    private readonly eventRepository: IEventRepository,
    private readonly orgAccess: IOrganizationAccessPort,
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
