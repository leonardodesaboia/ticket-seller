import { ProcessPaymentWebhookUseCase } from './process-payment-webhook.use-case';
import { ProcessChargebackUseCase } from './process-chargeback.use-case';
import { WebhookSignatureError } from '../../domain/payment-gateway.errors';
import {
  ParsedPaymentWebhook,
  PaymentGatewayPort,
  PaymentWebhookInput,
} from '../../domain/ports/payment-gateway.port';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IFinancialRecordPort } from '../../../finance/domain/ports/financial-record.port';

describe('ProcessPaymentWebhookUseCase', () => {
  const parsed: ParsedPaymentWebhook = {
    providerEventId: 'evt-1',
    externalPaymentId: 'fake_abc',
    eventType: 'PAYMENT_APPROVED',
    status: 'APPROVED',
    amount: 10000n,
    currency: 'BRL',
  };

  const gateway: PaymentGatewayPort = {
    provider: 'FAKE',
    getSupportedMethods: jest.fn().mockReturnValue(['FAKE_PIX']),
    createPayment: jest.fn(),
    parseWebhook: jest.fn<Promise<ParsedPaymentWebhook>, [PaymentWebhookInput]>(),
    refund: jest.fn(),
  };

  const makeAttemptRow = () => ({
    id: 'attempt-1',
    organization_id: 'org-1',
    order_id: 'order-1',
    external_payment_id: 'fake_abc',
    status: 'PENDING',
    amount: 10000n,
    currency: 'BRL',
  });

  const makeOrderRow = () => ({
    id: 'order-1',
    status: 'PENDING_PAYMENT',
    organization_id: 'org-1',
  });

  const mockChargeback = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProcessChargebackUseCase;

  const mockFinancialRecord: IFinancialRecordPort = {
    recordSale: jest.fn().mockResolvedValue(undefined),
    recordRefund: jest.fn().mockResolvedValue(undefined),
    recordChargeback: jest.fn().mockResolvedValue(undefined),
  };

  function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}): PrismaService {
    const $executeRaw = jest.fn().mockResolvedValue(1);
    const $queryRaw = jest.fn().mockResolvedValue([makeAttemptRow()]);
    const $transaction = jest.fn().mockImplementation(
      (fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => Promise<void>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([makeOrderRow()]),
          $executeRaw: jest.fn().mockResolvedValue(1),
        }),
    );
    return { $queryRaw, $executeRaw, $transaction, ...overrides } as unknown as PrismaService;
  }

  beforeEach(() => jest.clearAllMocks());

  it('throws WebhookSignatureError when gateway rejects signature', async () => {
    (gateway.parseWebhook as jest.Mock).mockRejectedValueOnce(new WebhookSignatureError());
    const prisma = makePrisma();
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await expect(
      uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'bad' }),
    ).rejects.toThrow(WebhookSignatureError);
  });

  it('does not process when webhook was already inserted (ON CONFLICT returns 0)', async () => {
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce(parsed);
    const prisma = makePrisma({ $executeRaw: jest.fn().mockResolvedValue(0) });
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    // Should return early without starting a transaction
    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns early without transaction when attempt is not found', async () => {
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce(parsed);
    const prisma = makePrisma({
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    });
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
    // Should still mark processed_at
    expect((prisma.$executeRaw as jest.Mock)).toHaveBeenCalledTimes(2); // INSERT + UPDATE processed_at
  });

  it('calls transaction for PAYMENT_APPROVED with matching amount/currency', async () => {
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce(parsed);
    const prisma = makePrisma();
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    expect((prisma.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('does not call transaction when amount mismatches', async () => {
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce({ ...parsed, amount: 9999n });
    const prisma = makePrisma();
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });

  it('calls transaction for PAYMENT_DECLINED', async () => {
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce({
      ...parsed,
      eventType: 'PAYMENT_DECLINED',
      status: 'DECLINED',
    });
    const prisma = makePrisma();
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    expect((prisma.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('ignores status regression for terminal attempts', async () => {
    const terminalAttempt = { ...makeAttemptRow(), status: 'APPROVED' };
    (gateway.parseWebhook as jest.Mock).mockResolvedValueOnce({
      ...parsed,
      eventType: 'PAYMENT_DECLINED',
      status: 'DECLINED',
    });
    const prisma = makePrisma({
      $queryRaw: jest.fn().mockResolvedValue([terminalAttempt]),
    });
    const uc = new ProcessPaymentWebhookUseCase(gateway, prisma, mockChargeback, mockFinancialRecord);

    await uc.execute({ provider: 'FAKE', rawBody: Buffer.from('{}'), signature: 'sig' });

    // Should not call transaction — status regression is ignored
    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });
});
