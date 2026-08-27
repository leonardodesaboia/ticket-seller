import { CreatePaymentAttemptUseCase } from './create-payment-attempt.use-case';
import {
  UnsupportedPaymentMethodError,
  PaymentIdempotencyConflictError,
  OrderNotPendingPaymentError,
  OrderExpiredForPaymentError,
  PaymentAlreadyActiveError,
} from '../../domain/payment-attempt.errors';
import { PaymentAttempt, PaymentAttemptProps } from '../../domain/payment-attempt.entity';
import {
  CreatePaymentAttemptData,
  IPaymentAttemptRepository,
  UpdatePaymentAttemptData,
} from '../../domain/ports/payment-attempt-repository.port';
import {
  CreatePaymentResult,
  ParsedPaymentWebhook,
  PaymentGatewayPort,
  PaymentMethod,
  PaymentWebhookInput,
} from '../../domain/ports/payment-gateway.port';
import { IOrderAccessPort, OrderForPayment } from '../ports/order-access.port';
import { IPaymentAttemptOperationPort } from '../ports/payment-attempt-operation.port';

function makeAttempt(overrides: Partial<PaymentAttemptProps> = {}): PaymentAttempt {
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
    ...overrides,
  });
}

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

describe('CreatePaymentAttemptUseCase', () => {
  const gatewayResult: CreatePaymentResult = {
    externalPaymentId: 'fake_abc',
    status: 'PENDING',
    checkoutData: null,
    expiresAt: new Date(Date.now() + 900000),
  };

  const gateway: PaymentGatewayPort = {
    provider: 'FAKE',
    getSupportedMethods: jest.fn().mockReturnValue(['FAKE_PIX', 'FAKE_CREDIT_CARD']),
    createPayment: jest.fn().mockResolvedValue(gatewayResult),
    parseWebhook: jest.fn<Promise<ParsedPaymentWebhook>, [PaymentWebhookInput]>(),
    refund: jest.fn(),
  };

  const attemptRepo: IPaymentAttemptRepository = {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    findActiveByOrderId: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((data: CreatePaymentAttemptData) =>
      makeAttempt({
        ...data,
        provider: 'FAKE',
        status: 'PENDING',
        paymentMethod: data.paymentMethod as PaymentMethod,
        failureCode: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    update: jest.fn<Promise<PaymentAttempt>, [string, UpdatePaymentAttemptData]>(),
    findById: jest.fn<Promise<PaymentAttempt | null>, [string]>(),
    findLatestByOrderId: jest.fn<Promise<PaymentAttempt | null>, [string]>(),
  };

  const orderAccess: IOrderAccessPort = {
    findOrderWithToken: jest.fn().mockResolvedValue(validOrder),
  };

  const operation: jest.Mocked<IPaymentAttemptOperationPort> = {
    persistAttemptWithCreatedEvent: jest.fn((data: CreatePaymentAttemptData) => attemptRepo.save(data)),
  };

  const useCase = new CreatePaymentAttemptUseCase(gateway, attemptRepo, orderAccess, operation);

  const baseInput = {
    orderId: 'order-1',
    reservationToken: 'abc',
    idempotencyKey: 'key-1',
    paymentMethod: 'FAKE_PIX',
  };

  beforeEach(() => jest.clearAllMocks());

  it('throws UnsupportedPaymentMethodError for unknown method', async () => {
    await expect(useCase.execute({ ...baseInput, paymentMethod: 'BOLETO' })).rejects.toThrow(
      UnsupportedPaymentMethodError,
    );
  });

  it('returns existing attempt on idempotent retry', async () => {
    const existing = makeAttempt();
    (attemptRepo.findByIdempotencyKey as jest.Mock).mockResolvedValueOnce(existing);
    const result = await useCase.execute(baseInput);
    expect(result).toBe(existing);
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('throws PaymentIdempotencyConflictError when key used for different order', async () => {
    (attemptRepo.findByIdempotencyKey as jest.Mock).mockResolvedValueOnce(
      makeAttempt({ orderId: 'other-order' }),
    );
    await expect(useCase.execute(baseInput)).rejects.toThrow(PaymentIdempotencyConflictError);
  });

  it('throws OrderNotPendingPaymentError when order is PAID', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce({
      ...validOrder,
      status: 'PAID',
    });
    await expect(useCase.execute(baseInput)).rejects.toThrow(OrderNotPendingPaymentError);
  });

  it('throws OrderExpiredForPaymentError when order is expired', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce({
      ...validOrder,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(useCase.execute(baseInput)).rejects.toThrow(OrderExpiredForPaymentError);
  });

  it('throws PaymentAlreadyActiveError when active attempt exists', async () => {
    (attemptRepo.findActiveByOrderId as jest.Mock).mockResolvedValueOnce(
      makeAttempt({ status: 'PENDING' }),
    );
    await expect(useCase.execute(baseInput)).rejects.toThrow(PaymentAlreadyActiveError);
  });

  it('uses order.totalAmount for the gateway call, not from input', async () => {
    await useCase.execute(baseInput);
    expect(gateway.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000n, currency: 'BRL' }),
    );
  });
});
