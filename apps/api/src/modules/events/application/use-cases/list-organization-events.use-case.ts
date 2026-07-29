import { Inject, Injectable } from '@nestjs/common';
import { OrganizationAccessDeniedError } from '../../domain/event.errors';
import {
  EVENT_REPOSITORY,
  type IEventRepository,
  type ListEventsResult,
} from '../../domain/ports/event-repository.port';
import {
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface ListOrganizationEventsQuery {
  organizationId: string;
  actorId: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class ListOrganizationEventsUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(query: ListOrganizationEventsQuery): Promise<ListEventsResult> {
    const member = await this.orgAccess.findMember(query.organizationId, query.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    return this.eventRepository.findByOrganization({
      organizationId: query.organizationId,
      limit: Math.min(query.limit, 100),
      ...(query.cursor !== undefined && { cursor: query.cursor }),
    });
  }
}
