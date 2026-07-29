import { Inject, Injectable } from '@nestjs/common';
import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';
import {
  TicketTypeNotFoundError,
  TicketTypeVersionConflictError,
} from '../../../domain/ticket-types/ticket-type.errors';
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

export interface UpdateTicketTypeCommand {
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  actorId: string;
  expectedVersion: number;
  name?: string;
  description?: string | null;
  priceAmount?: number;
  capacity?: number;
  status?: string;
}

@Injectable()
export class UpdateTicketTypeUseCase {
  constructor(
    @Inject(TICKET_TYPE_REPOSITORY) private readonly ticketTypeRepository: ITicketTypeRepository,
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: UpdateTicketTypeCommand): Promise<TicketType> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);
    if (!member || member.status !== 'ACTIVE') throw new OrganizationAccessDeniedError();
    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) throw new InsufficientRoleError();

    const event = await this.eventRepository.findByOrganizationAndId(
      command.organizationId,
      command.eventId,
    );
    if (!event) throw new EventNotFoundError();
    if (event.status !== 'DRAFT') throw new EventNotInDraftError();

    const ticketType = await this.ticketTypeRepository.findByEventAndId(
      command.eventId,
      command.ticketTypeId,
    );
    if (!ticketType) throw new TicketTypeNotFoundError();

    if (ticketType.version !== command.expectedVersion) throw new TicketTypeVersionConflictError();

    return this.ticketTypeRepository.update({
      ticketTypeId: command.ticketTypeId,
      eventId: command.eventId,
      organizationId: command.organizationId,
      expectedVersion: command.expectedVersion,
      ...(command.name !== undefined && { name: command.name }),
      ...(command.description !== undefined && { description: command.description }),
      ...(command.priceAmount !== undefined && { priceAmount: command.priceAmount }),
      ...(command.capacity !== undefined && { capacity: command.capacity }),
      ...(command.status !== undefined && { status: command.status }),
    });
  }
}
