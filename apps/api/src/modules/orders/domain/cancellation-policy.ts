export type CancellationEligibilityCode =
  | 'CANCELLATION_ALLOWED'
  | 'ORDER_ALREADY_CANCELLED'
  | 'ORDER_IN_TERMINAL_STATE'
  | 'TICKET_ALREADY_USED'
  | 'TICKET_TRANSFER_PENDING';

export type CancellationSource = 'CUSTOMER' | 'ADMIN' | 'SYSTEM' | 'EVENT_CANCELLED';

export interface CancellationContext {
  orderStatus: string;
  hasAdmittedCheckIn: boolean;
  hasActivePendingTransfer: boolean;
}

const CANCELLABLE_STATUSES = ['PENDING_PAYMENT', 'TICKETS_ISSUED'];

export function evaluateCancellationEligibility(ctx: CancellationContext): CancellationEligibilityCode {
  if (ctx.orderStatus === 'CANCELLED') return 'ORDER_ALREADY_CANCELLED';
  if (!CANCELLABLE_STATUSES.includes(ctx.orderStatus)) return 'ORDER_IN_TERMINAL_STATE';

  if (ctx.orderStatus === 'TICKETS_ISSUED') {
    if (ctx.hasAdmittedCheckIn) return 'TICKET_ALREADY_USED';
    if (ctx.hasActivePendingTransfer) return 'TICKET_TRANSFER_PENDING';
  }

  return 'CANCELLATION_ALLOWED';
}
