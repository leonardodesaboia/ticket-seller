import type { OrderView } from '../../domain/ports/order-repository.port';

export interface CreateOrderFromReservationInput {
  reservationId: string;
  tokenHash: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface IReservationAccess {
  createOrderFromActiveReservation(input: CreateOrderFromReservationInput): Promise<OrderView>;
}

export const RESERVATION_ACCESS = Symbol('RESERVATION_ACCESS');
