import { createHash } from 'crypto';
import type { IOrderRepository } from '../../domain/ports/order-repository.port';
import { GetOrderUseCase } from './get-order.use-case';

describe('GetOrderUseCase', () => {
  it('hashes the continuation token before delegating the protected order lookup', async () => {
    const repository: jest.Mocked<IOrderRepository> = {
      get: jest.fn().mockResolvedValue({
        orderId: 'order-id',
        reservationId: 'reservation-id',
        status: 'PENDING_PAYMENT',
        currency: 'BRL',
        subtotalAmount: 5000,
        totalAmount: 5000,
        expiresAt: '2026-08-11T12:15:00.000Z',
        items: [],
      }),
    };

    await new GetOrderUseCase(repository).execute('order-id', 'plain-continuation-token');

    expect(repository.get).toHaveBeenCalledWith(
      'order-id',
      createHash('sha256').update('plain-continuation-token').digest('hex'),
    );
  });
});
