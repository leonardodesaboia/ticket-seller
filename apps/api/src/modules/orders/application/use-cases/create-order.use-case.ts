import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  RESERVATION_ACCESS,
  type CreateOrderFromReservationInput,
  type IReservationAccess,
} from '../ports/reservation-access.port';
import type { OrderView } from '../../domain/ports/order-repository.port';

@Injectable()
export class CreateOrderUseCase {
  constructor(@Inject(RESERVATION_ACCESS) private readonly reservationAccess: IReservationAccess) {}

  execute(input: { reservationId: string; reservationToken: string; idempotencyKey: string }): Promise<OrderView> {
    const operation: CreateOrderFromReservationInput = {
      reservationId: input.reservationId,
      tokenHash: createHash('sha256').update(input.reservationToken).digest('hex'),
      idempotencyKey: input.idempotencyKey,
      requestHash: createHash('sha256').update(JSON.stringify({ reservationId: input.reservationId })).digest('hex'),
    };
    return this.reservationAccess.createOrderFromActiveReservation(operation);
  }
}
