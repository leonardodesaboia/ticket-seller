import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';
import {
  ITicketTypeRepository,
} from '../../../domain/ticket-types/ticket-type-repository.port';
import {
  type IEventRepository,
} from '../../../domain/ports/event-repository.port';
import {
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

export class ListEventTicketTypesUseCase {
  constructor(
    private readonly ticketTypeRepository: ITicketTypeRepository,
    private readonly eventRepository: IEventRepository,
    private readonly orgAccess: IOrganizationAccessPort,
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
