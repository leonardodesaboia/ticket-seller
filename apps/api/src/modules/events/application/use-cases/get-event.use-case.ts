import { Inject, Injectable } from '@nestjs/common';
import type { Event } from '../../domain/event.entity';
import { EventNotFoundError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import { EVENT_REPOSITORY, type IEventRepository } from '../../domain/ports/event-repository.port';
import {
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface GetEventQuery {
  organizationId: string;
  eventId: string;
  actorId: string;
}

@Injectable()
export class GetEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
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
