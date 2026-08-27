import type { Event } from '../../domain/event.entity';
import { EventNotFoundError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import { type IEventRepository } from '../../domain/ports/event-repository.port';
import {
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface GetEventQuery {
  organizationId: string;
  eventId: string;
  actorId: string;
}

export class GetEventUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(query: GetEventQuery): Promise<Event> {
    const member = await this.orgAccess.findMember(query.organizationId, query.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    const event = await this.eventRepository.findByOrganizationAndId(
      query.organizationId,
      query.eventId,
    );

    if (!event) {
      throw new EventNotFoundError();
    }

    return event;
  }
}
