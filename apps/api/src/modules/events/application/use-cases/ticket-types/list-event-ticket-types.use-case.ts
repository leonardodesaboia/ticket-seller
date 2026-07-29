import { Inject, Injectable } from '@nestjs/common';
import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';
import {
  ITicketTypeRepository,
  TICKET_TYPE_REPOSITORY,
} from '../../../domain/ticket-types/ticket-type-repository.port';
import {
  EVENT_REPOSITORY,
  type IEventRepository,
} from '../../../domain/ports/event-repository.port';
import {
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../../domain/ports/organization-access.port';
import {
  EventNotFoundError,
  OrganizationAccessDeniedError,
} from '../../../domain/event.errors';

export interface ListEventTicketTypesCommand {
  organizationId: string;
  eventId: string;
  actorId: string;
}

@Injectable()
export class ListEventTicketTypesUseCase {
  constructor(
    @Inject(TICKET_TYPE_REPOSITORY) private readonly ticketTypeRepository: ITicketTypeRepository,
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: ListEventTicketTypesCommand): Promise<TicketType[]> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);
    if (!member || member.status !== 'ACTIVE') throw new OrganizationAccessDeniedError();

    const event = await this.eventRepository.findByOrganizationAndId(
      command.organizationId,
      command.eventId,
    );
    if (!event) throw new EventNotFoundError();

    return this.ticketTypeRepository.findByEvent(command.eventId, command.organizationId);
  }
}
