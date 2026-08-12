import { GetPaymentAttemptUseCase } from './get-payment-attempt.use-case';
import {
  InvalidReservationTokenForPaymentError,
  PaymentAttemptNotFoundError,
} from '../../domain/payment-attempt.errors';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';
import {
  IPaymentAttemptRepository,
  UpdatePaymentAttemptData,
  CreatePaymentAttemptData,
} from '../../domain/ports/payment-attempt-repository.port';
import { IOrderAccessPort, OrderForPayment } from '../ports/order-access.port';

function makeAttempt(): PaymentAttempt {
  return new PaymentAttempt({
    id: 'att-1',
    organizationId: 'org-1',
    orderId: 'order-1',
    provider: 'FAKE',
    externalPaymentId: 'fake_abc',
    status: 'PENDING',
    paymentMethod: 'FAKE_PIX',
    amount: 10000n,
    currency: 'BRL',
    idempotencyKey: 'key-1',
    failureCode: null,
    checkoutData: null,
    expiresAt: new Date(Date.now() + 600000),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('GetPaymentAttemptUseCase', () => {
  const validOrder: OrderForPayment = {
    id: 'order-1',
    organizationId: 'org-1',
    reservationId: 'res-1',
    continuationTokenHash: 'hash',
    status: 'PENDING_PAYMENT',
    currency: 'BRL',
    totalAmount: 10000n,
    expiresAt: new Date(Date.now() + 600000),
  };

  const orderAccess: IOrderAccessPort = {
    findOrderWithToken: jest.fn().mockResolvedValue(validOrder),
  };

  const attemptRepo: IPaymentAttemptRepository = {
    findLatestByOrderId: jest.fn().mockResolvedValue(makeAttempt()),
    findByIdempotencyKey: jest.fn<Promise<PaymentAttempt | null>, [string]>(),
    findActiveByOrderId: jest.fn<Promise<PaymentAttempt | null>, [string]>(),
    findById: jest.fn<Promise<PaymentAttempt | null>, [string]>(),
    save: jest.fn<Promise<PaymentAttempt>, [CreatePaymentAttemptData]>(),
    update: jest.fn<Promise<PaymentAttempt>, [string, UpdatePaymentAttemptData]>(),
  };

  const useCase = new GetPaymentAttemptUseCase(attemptRepo, orderAccess);

  beforeEach(() => jest.clearAllMocks());

  it('throws InvalidReservationTokenForPaymentError when token invalid', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce(null);
    await expect(useCase.execute('order-1', 'bad-token')).rejects.toThrow(
      InvalidReservationTokenForPaymentError,
    );
  });

  it('throws PaymentAttemptNotFoundError when no attempt exists', async () => {
    (attemptRepo.findLatestByOrderId as jest.Mock).mockResolvedValueOnce(null);
    await expect(useCase.execute('order-1', 'token')).rejects.toThrow(PaymentAttemptNotFoundError);
  });

  it('returns latest attempt for valid token', async () => {
    const result = await useCase.execute('order-1', 'token');
    expect(result.id).toBe('att-1');
  });
});
