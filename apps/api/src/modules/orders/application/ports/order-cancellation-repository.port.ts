import { CancellationSource } from '../../domain/cancellation-policy';

export interface OrderForCancellation {
  id: string;
  organizationId: string;
  eventId: string;
  reservationId: string;
  status: string;
  totalAmount: bigint;
  currency: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
}

export interface CancelPrePaymentOrderParams {
  orderId: string;
  organizationId: string;
  source: CancellationSource;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export interface CancelPostPaymentOrderParams {
  orderId: string;
  organizationId: string;
  source: CancellationSource;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export interface CancelPostPaymentOrderResult {
  cancelledTicketIds: string[];
}

export interface IOrderCancellationRepository {
  // Admin path: find by organizationId + orderId
  findForCancellation(organizationId: string, orderId: string): Promise<OrderForCancellation | null>;
  // Buyer path: find by orderId + token (derives organizationId from order)
  findForCancellationByToken(orderId: string, token: string): Promise<OrderForCancellation | null>;
  hasAdmittedCheckInForOrder(organizationId: string, orderId: string): Promise<boolean>;
  hasPendingTransferForOrder(organizationId: string, orderId: string): Promise<boolean>;
  cancelPrePaymentOrder(params: CancelPrePaymentOrderParams): Promise<void>;
  cancelPostPaymentOrder(params: CancelPostPaymentOrderParams): Promise<CancelPostPaymentOrderResult>;
}

export const ORDER_CANCELLATION_REPOSITORY = Symbol('ORDER_CANCELLATION_REPOSITORY');
