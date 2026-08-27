import {
  type IPublicationReadinessQueryPort,
} from '../ports/publication-readiness-query.port';
import {
  EVENT_CREATOR_ROLES,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';
import {
  EventNotFoundError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import {
  PublicationReadinessPolicy,
  type PublicationReadiness,
} from '../../domain/publication/publication-readiness.policy';

export interface GetPublicationReadinessQuery {
  organizationId: string;
  eventId: string;
  actorId: string;
}

export class GetPublicationReadinessUseCase {
  constructor(
    private readonly queryPort: IPublicationReadinessQueryPort,
    private readonly organizationAccess: IOrganizationAccessPort,
    private readonly policy: PublicationReadinessPolicy,
  ) {}

  async execute(query: GetPublicationReadinessQuery): Promise<PublicationReadiness> {
    const member = await this.organizationAccess.findMember(query.organizationId, query.actorId);
    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }
    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    const snapshot = await this.queryPort.findSnapshot(query.organizationId, query.eventId);
    if (!snapshot) throw new EventNotFoundError();

    return this.policy.evaluate(snapshot, new Date());
  }
}
