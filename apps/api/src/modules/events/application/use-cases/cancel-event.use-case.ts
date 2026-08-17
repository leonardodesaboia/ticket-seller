import { Inject, Injectable } from '@nestjs/common';
import { EventNotCancellableError, EventNotFoundError } from '../../domain/event-cancellation.errors';
import {
  EVENT_CANCELLATION_REPOSITORY,
  IEventCancellationRepository,
  CancelEventResult,
} from '../ports/event-cancellation-repository.port';

export interface CancelEventInput {
  eventId: string;
  organizationId: string;
  reason?: string | undefined;
  actorId?: string | undefined;
}

@Injectable()
export class CancelEventUseCase {
  constructor(
    @Inject(EVENT_CANCELLATION_REPOSITORY)
    private readonly repo: IEventCancellationRepository,
  ) {}

  async execute(input: CancelEventInput): Promise<CancelEventResult> {
    const { eventId, organizationId, reason, actorId } = input;

    // 1. Fetch event and verify it belongs to the org
    const eventRow = await this.repo.getEventStatus(eventId, organizationId);

    // 2. Validate: event exists and belongs to org
    if (!eventRow) {
      throw new EventNotFoundError();
    }

    // 3. Verify status: if already CANCELLED → throw EventNotCancellableError (422)
    if (eventRow.status === 'CANCELLED') {
      throw new EventNotCancellableError('EVENT_ALREADY_CANCELLED');
    }

    // 4. Verify event is in a cancellable state (PUBLISHED or DRAFT)
    if (eventRow.status !== 'PUBLISHED' && eventRow.status !== 'DRAFT') {
      throw new EventNotCancellableError(`EVENT_IN_NON_CANCELLABLE_STATE`);
    }

    // 5. Perform cancellation inside a transaction
    return this.repo.cancelEvent({ eventId, organizationId, reason, actorId });
  }
}
