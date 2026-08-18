import { ProcessRefundUseCase } from './process-refund.use-case';
import {
  OrderNotFoundForRefundError,
  OrderNotRefundableError,
  RefundGatewayError,
} from '../../domain/refund.errors';
import { PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IFinancialRecordPort } from '../../../finance/domain/ports/financial-record.port';

function makeFinancialRecord(): IFinancialRecordPort {
  return {
    recordSale: jest.fn().mockResolvedValue(undefined),
    recordRefund: jest.fn().mockResolvedValue(undefined),
    recordChargeback: jest.fn().mockResolvedValue(undefined),
  };
}

const APPROVED_ATTEMPT = { id: 'attempt-1', external_payment_id: 'fake_ext_1' };
const CANCELLED_ORDER = {
  id: 'order-1',
  organization_id: 'org-1',
  status: 'CANCELLED',
  total_amount: 10000n,
  currency: 'BRL',
};
const REFUND_ROW = {
  id: 'refund-1',
  status: 'PENDING',
  external_refund_id: null,
  amount: 10000n,
  currency: 'BRL',
};

function makeGateway(overrides: Partial<PaymentGatewayPort> = {}): PaymentGatewayPort {
  return {
    provider: 'FAKE',
    getSupportedMethods: jest.fn().mockReturnValue(['FAKE_PIX']),
    createPayment: jest.fn(),
    parseWebhook: jest.fn(),
    refund: jest.fn().mockResolvedValue({ externalRefundId: 'fake_refund_abc', status: 'SUCCESS' }),
    ...overrides,
  };
}

function makePrisma(
  orderRows: unknown[] = [CANCELLED_ORDER],
  attemptRows: unknown[] = [APPROVED_ATTEMPT],
  refundRows: unknown[] = [REFUND_ROW],
): PrismaService {
  const $queryRaw = jest
    .fn()
    .mockResolvedValueOnce(orderRows)
    .mockResolvedValueOnce(attemptRows)
    .mockResolvedValueOnce(refundRows);

  const $executeRaw = jest.fn().mockResolvedValue(1);

  const $transaction = jest.fn().mockImplementation(
    async (fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => Promise<void>) => {
      const txQueryRaw = jest.fn().mockResolvedValue([{ status: 'CANCELLED' }]);
      const txExecuteRaw = jest.fn().mockResolvedValue(1);
      await fn({ $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw });
    },
  );

  return { $queryRaw, $executeRaw, $transaction } as unknown as PrismaService;
}

describe('ProcessRefundUseCase', () => {
  const input = { orderId: 'order-1', organizationId: 'org-1' };

  beforeEach(() => jest.clearAllMocks());

  it('returns REFUNDED result on success', async () => {
    const gateway = makeGateway();
    const prisma = makePrisma();
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    const result = await uc.execute(input);

    expect(result.status).toBe('REFUNDED');
    expect(result.externalRefundId).toBe('fake_refund_abc');
    expect(result.refundedAmount).toBe(10000);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });

  it('throws OrderNotFoundForRefundError when order does not exist', async () => {
    const gateway = makeGateway();
    const prisma = makePrisma([]);
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(OrderNotFoundForRefundError);
  });

  it('throws OrderNotRefundableError when order is not CANCELLED', async () => {
    const gateway = makeGateway();
    const order = { ...CANCELLED_ORDER, status: 'TICKETS_ISSUED' };
    const prisma = makePrisma([order]);
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(OrderNotRefundableError);
  });

  it('throws OrderNotRefundableError when order is already REFUNDED', async () => {
    const gateway = makeGateway();
    const order = { ...CANCELLED_ORDER, status: 'REFUNDED' };
    const prisma = makePrisma([order]);
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(OrderNotRefundableError);
  });

  it('throws OrderNotRefundableError when no APPROVED payment attempt exists', async () => {
    const gateway = makeGateway();
    const prisma = makePrisma([CANCELLED_ORDER], []);
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(OrderNotRefundableError);
  });

  it('returns early with existing refund when already SUCCESS (idempotent)', async () => {
    const gateway = makeGateway();
    const existingRefund = {
      ...REFUND_ROW,
      status: 'SUCCESS',
      external_refund_id: 'fake_refund_existing',
    };
    const prisma = makePrisma([CANCELLED_ORDER], [APPROVED_ATTEMPT], [existingRefund]);
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    const result = await uc.execute(input);

    expect(result.externalRefundId).toBe('fake_refund_existing');
    expect(gateway.refund).not.toHaveBeenCalled();
  });

  it('throws RefundGatewayError when gateway throws', async () => {
    const gateway = makeGateway({
      refund: jest.fn().mockRejectedValue(new Error('PSP timeout')),
    });
    const prisma = makePrisma();
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(RefundGatewayError);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('throws RefundGatewayError when gateway returns FAILED status', async () => {
    const gateway = makeGateway({
      refund: jest.fn().mockResolvedValue({ externalRefundId: 'fake_x', status: 'FAILED' }),
    });
    const prisma = makePrisma();
    const uc = new ProcessRefundUseCase(gateway, prisma, makeFinancialRecord());

    await expect(uc.execute(input)).rejects.toThrow(RefundGatewayError);
  });
});
