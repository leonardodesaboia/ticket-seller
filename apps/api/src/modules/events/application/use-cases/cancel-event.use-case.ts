import { EventNotCancellableError, EventNotFoundError } from '../../domain/event-cancellation.errors';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import {
  IEventCancellationRepository,
  CancelEventResult,
} from '../ports/event-cancellation-repository.port';
import {
  EVENT_CREATOR_ROLES,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface CancelEventInput {
  eventId: string;
  organizationId: string;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export class CancelEventUseCase {
  constructor(
    private readonly repo: IEventCancellationRepository,
    private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(input: CancelEventInput): Promise<CancelEventResult> {
    const { eventId, organizationId, reason, actorId } = input;

    // 1. Authorization: verify actor is an active member with event-creator role
    if (actorId) {
      const member = await this.orgAccess.findMember(organizationId, actorId);
      if (!member || member.status !== 'ACTIVE') {
        throw new OrganizationAccessDeniedError();
      }
      if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
        throw new InsufficientRoleError();
      }
    }

    // 2. Fetch event and verify it belongs to the org
    const eventRow = await this.repo.getEventStatus(eventId, organizationId);

    // 3. Validate: event exists and belongs to org
    if (!eventRow) {
      throw new EventNotFoundError();
    }

    // 4. Verify status: if already CANCELLED → throw EventNotCancellableError (422)
    if (eventRow.status === 'CANCELLED') {
      throw new EventNotCancellableError('EVENT_ALREADY_CANCELLED');
    }

    // 5. Verify event is in a cancellable state (PUBLISHED or DRAFT)
    if (eventRow.status !== 'PUBLISHED' && eventRow.status !== 'DRAFT') {
      throw new EventNotCancellableError(`EVENT_IN_NON_CANCELLABLE_STATE`);
    }

    // 6. Perform cancellation inside a transaction
    return this.repo.cancelEvent({ eventId, organizationId, reason, actorId });
  }
}
