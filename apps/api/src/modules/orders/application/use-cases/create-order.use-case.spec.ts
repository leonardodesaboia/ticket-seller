import { createHash } from 'crypto';
import type { IReservationAccess } from '../ports/reservation-access.port';
import { CreateOrderUseCase } from './create-order.use-case';

describe('CreateOrderUseCase', () => {
  it('hashes the reservation token and builds a stable request hash from the reservation identity', async () => {
    const reservationAccess: jest.Mocked<IReservationAccess> = {
      createOrderFromActiveReservation: jest.fn().mockResolvedValue({
        orderId: 'order-id',
        reservationId: 'reservation-id',
        status: 'PENDING_PAYMENT',
        currency: 'BRL',
        subtotalAmount: 10000,
        totalAmount: 10000,
        expiresAt: '2026-08-11T12:15:00.000Z',
        items: [],
      }),
    };
    const useCase = new CreateOrderUseCase(reservationAccess);

    await useCase.execute({
      reservationId: 'reservation-id',
      reservationToken: 'plain-continuation-token',
      idempotencyKey: 'idempotency-key',
      buyerEmail: 'buyer@example.com',
    });

    expect(reservationAccess.createOrderFromActiveReservation).toHaveBeenCalledWith({
      reservationId: 'reservation-id',
      tokenHash: createHash('sha256').update('plain-continuation-token').digest('hex'),
      idempotencyKey: 'idempotency-key',
      requestHash: createHash('sha256')
        .update(JSON.stringify({ reservationId: 'reservation-id', idempotencyKey: 'idempotency-key' }))
        .digest('hex'),
      buyerEmail: 'buyer@example.com',
    });
  });
});
