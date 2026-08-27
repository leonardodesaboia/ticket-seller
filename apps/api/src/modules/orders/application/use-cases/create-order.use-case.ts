import { createHash } from 'crypto';
import {
  type CreateOrderFromReservationInput,
  type IReservationAccess,
} from '../ports/reservation-access.port';
import type { OrderView } from '../../domain/ports/order-repository.port';

export class CreateOrderUseCase {
  constructor(private readonly reservationAccess: IReservationAccess) {}

  execute(input: { reservationId: string; reservationToken: string; idempotencyKey: string; buyerEmail: string }): Promise<OrderView> {
    const operation: CreateOrderFromReservationInput = {
      reservationId: input.reservationId,
      tokenHash: createHash('sha256').update(input.reservationToken).digest('hex'),
      idempotencyKey: input.idempotencyKey,
      requestHash: createHash('sha256').update(JSON.stringify({ reservationId: input.reservationId, idempotencyKey: input.idempotencyKey })).digest('hex'),
      buyerEmail: input.buyerEmail,
    };
    return this.reservationAccess.createOrderFromActiveReservation(operation);
  }
}
