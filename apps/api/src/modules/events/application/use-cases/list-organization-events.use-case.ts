import { OrganizationAccessDeniedError } from '../../domain/event.errors';
import {
  type IEventRepository,
  type ListEventsResult,
} from '../../domain/ports/event-repository.port';
import {
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface ListOrganizationEventsQuery {
  organizationId: string;
  actorId: string;
  cursor?: string;
  limit: number;
}

export class ListOrganizationEventsUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly orgAccess: IOrganizationAccessPort,
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
