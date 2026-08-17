export interface CancelEventResponse {
  eventId: string;
  organizationId: string;
  status: 'CANCELLED';
  cancelledAt: string;
  ordersCancelledCount: number;
}
