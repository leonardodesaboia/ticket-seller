export interface CancelEventParams {
  eventId: string;
  organizationId: string;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export interface CancelEventResult {
  eventId: string;
  organizationId: string;
  status: 'CANCELLED';
  cancelledAt: Date;
  ordersCancelledCount: number;
}

export interface IEventCancellationRepository {
  cancelEvent(params: CancelEventParams): Promise<CancelEventResult>;
  getEventStatus(eventId: string, organizationId: string): Promise<{ status: string } | null>;
}

export const EVENT_CANCELLATION_REPOSITORY = Symbol('EVENT_CANCELLATION_REPOSITORY');
