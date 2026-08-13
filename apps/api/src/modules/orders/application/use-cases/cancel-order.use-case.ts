import { Inject, Injectable } from '@nestjs/common';
import { evaluateCancellationEligibility } from '../../domain/cancellation-policy';
import {
  OrderNotFoundForCancellationError,
  InvalidReservationTokenError,
  OrderNotCancellableError,
} from '../../domain/cancellation.errors';
import {
  IOrderCancellationRepository,
  ORDER_CANCELLATION_REPOSITORY,
} from '../ports/order-cancellation-repository.port';

export interface CancelOrderByTokenInput {
  orderId: string;
  reservationToken: string;
  reason?: string | undefined;
}

export interface CancelOrderByAdminInput {
  orderId: string;
  organizationId: string;
  reason?: string | undefined;
  actorId?: string | undefined;
  // actorRole: deferred until auth system exposes member roles
}

export interface CancelOrderResult {
  orderId: string;
  organizationId: string;
  status: 'CANCELLED';
  cancelledAt: Date;
  ticketsCancelledCount: number;
  requiresRefund: boolean;
}

@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(ORDER_CANCELLATION_REPOSITORY)
    private readonly repo: IOrderCancellationRepository,
  ) {}

  async executeByToken(input: CancelOrderByTokenInput): Promise<CancelOrderResult> {
    const { orderId, reservationToken, reason } = input;

    // Find and validate token in one query (no separate token validation round-trip)
    const order = await this.repo.findForCancellationByToken(orderId, reservationToken);
    if (!order) throw new InvalidReservationTokenError();

    // Distinguish CANCELLED (idempotent) from other terminal states
    if (order.status === 'CANCELLED') {
      throw new OrderNotCancellableError('ORDER_ALREADY_CANCELLED');
    }

    // Buyers can only cancel PENDING_PAYMENT orders
    if (order.status !== 'PENDING_PAYMENT') {
      throw new OrderNotCancellableError('ORDER_IN_TERMINAL_STATE');
    }

    await this.repo.cancelPrePaymentOrder({
      orderId,
      organizationId: order.organizationId,
      source: 'CUSTOMER',
      reason,
    });

    return {
      orderId,
      organizationId: order.organizationId,
      status: 'CANCELLED',
      cancelledAt: new Date(),
      ticketsCancelledCount: 0,
      requiresRefund: false,
    };
  }

  async executeByAdmin(input: CancelOrderByAdminInput): Promise<CancelOrderResult> {
    const { orderId, organizationId, reason, actorId } = input;

    const order = await this.repo.findForCancellation(organizationId, orderId);
    if (!order) throw new OrderNotFoundForCancellationError();

    let hasAdmittedCheckIn = false;
    let hasPendingTransfer = false;
    if (order.status === 'TICKETS_ISSUED') {
      [hasAdmittedCheckIn, hasPendingTransfer] = await Promise.all([
        this.repo.hasAdmittedCheckInForOrder(organizationId, orderId),
        this.repo.hasPendingTransferForOrder(organizationId, orderId),
      ]);
    }

    const eligibility = evaluateCancellationEligibility({
      orderStatus: order.status,
      hasAdmittedCheckIn,
      hasActivePendingTransfer: hasPendingTransfer,
    });

    if (eligibility !== 'CANCELLATION_ALLOWED') {
      throw new OrderNotCancellableError(eligibility);
    }

    const now = new Date();

    if (order.status === 'PENDING_PAYMENT') {
      await this.repo.cancelPrePaymentOrder({ orderId, organizationId, source: 'ADMIN', reason, actorId });
      return { orderId, organizationId, status: 'CANCELLED', cancelledAt: now, ticketsCancelledCount: 0, requiresRefund: false };
    }

    const result = await this.repo.cancelPostPaymentOrder({ orderId, organizationId, source: 'ADMIN', reason, actorId });
    return {
      orderId,
      organizationId,
      status: 'CANCELLED',
      cancelledAt: now,
      ticketsCancelledCount: result.cancelledTicketIds.length,
      requiresRefund: true,
    };
  }
}
