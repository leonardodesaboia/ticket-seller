import { ProcessChargebackUseCase, ProcessChargebackInput } from './process-chargeback.use-case';
import { PrismaService } from '../../../../platform/database/prisma.service';

const ATTEMPT_ROW = {
  id: 'attempt-1',
  organization_id: 'org-1',
  order_id: 'order-1',
  external_payment_id: 'fake_ext_1',
};

const ORDER_TICKETS_ISSUED = {
  id: 'order-1',
  status: 'TICKETS_ISSUED',
  organization_id: 'org-1',
};

const ORDER_PAID = {
  id: 'order-1',
  status: 'PAID',
  organization_id: 'org-1',
};

const BASE_INPUT: ProcessChargebackInput = {
  provider: 'FAKE',
  providerEventId: 'evt-dispute-1',
  externalPaymentId: 'fake_ext_1',
  amount: 10000n,
  currency: 'BRL',
};

function makePrisma(overrides: {
  attemptRows?: unknown[];
  disputeInsertResult?: number;
  orderRows?: unknown[];
  cancelledTicketRows?: unknown[];
  transactionFn?: jest.Mock;
  executeRawResults?: number[];
} = {}): PrismaService {
  const attemptRows = overrides.attemptRows ?? [ATTEMPT_ROW];
  const orderRows = overrides.orderRows ?? [ORDER_TICKETS_ISSUED];
  const disputeInsertResult = overrides.disputeInsertResult ?? 1;
  const cancelledTicketRows = overrides.cancelledTicketRows ?? [{ id: 'ticket-1' }];

  // Sequence: 1st $queryRaw → attempts, 2nd $queryRaw → orders
  const $queryRaw = jest
    .fn()
    .mockResolvedValueOnce(attemptRows)   // attempt lookup
    .mockResolvedValueOnce(orderRows);     // order lookup

  // Sequence: 1st $executeRaw → INSERT dispute, 2nd → UPDATE dispute updated_at (processed)
  const executeRawResults = overrides.executeRawResults ?? [disputeInsertResult, 1];
  let executeRawCallIdx = 0;
  const $executeRaw = jest.fn().mockImplementation(() => {
    const result = executeRawResults[executeRawCallIdx] ?? 1;
    executeRawCallIdx++;
    return Promise.resolve(result);
  });

  const $transaction =
    overrides.transactionFn ??
    jest.fn().mockImplementation(
      async (
        fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => Promise<void>,
      ) => {
        const txQueryRaw = jest
          .fn()
          .mockResolvedValueOnce([ORDER_TICKETS_ISSUED]) // SELECT FOR UPDATE
          .mockResolvedValueOnce(cancelledTicketRows);   // UPDATE tickets ... RETURNING id
        const txExecuteRaw = jest.fn().mockResolvedValue(1);
        await fn({ $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw });
      },
    );

  return { $queryRaw, $executeRaw, $transaction } as unknown as PrismaService;
}

describe('ProcessChargebackUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PAYMENT_DISPUTED with order TICKETS_ISSUED → CHARGEBACK + tickets CANCELLED + outbox emitted', async () => {
    const prisma = makePrisma();
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    // INSERT dispute was called
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2); // INSERT + UPDATE processed
    // Transaction was called (tickets cancel, inventory release, order update, outbox)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('PAYMENT_DISPUTED duplicated → idempotent (ON CONFLICT returns 0 rows, no transaction)', async () => {
    const prisma = makePrisma({ disputeInsertResult: 0, executeRawResults: [0] });
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    // Only the INSERT was called; no further processing
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('order already CHARGEBACK → skips state transition gracefully', async () => {
    const chargebackOrder = { ...ORDER_TICKETS_ISSUED, status: 'CHARGEBACK' };
    const prisma = makePrisma({ orderRows: [chargebackOrder], executeRawResults: [1, 1] });
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    // Dispute inserted but transaction not called (status not PAID/TICKETS_ISSUED)
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // Second $executeRaw marks dispute updated_at
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('order CANCELLED → skips state transition gracefully', async () => {
    const cancelledOrder = { ...ORDER_TICKETS_ISSUED, status: 'CANCELLED' };
    const prisma = makePrisma({ orderRows: [cancelledOrder], executeRawResults: [1, 1] });
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('order not found → logs + returns without error, dispute updated', async () => {
    // Override: after dispute insert, order query returns empty
    const $queryRaw = jest
      .fn()
      .mockResolvedValueOnce([ATTEMPT_ROW]) // attempt found
      .mockResolvedValueOnce([]);            // order not found

    const $executeRaw = jest
      .fn()
      .mockResolvedValueOnce(1)  // INSERT dispute
      .mockResolvedValueOnce(1); // UPDATE updated_at

    const $transaction = jest.fn();
    const prisma = { $queryRaw, $executeRaw, $transaction } as unknown as PrismaService;
    const uc = new ProcessChargebackUseCase(prisma);

    await expect(uc.execute(BASE_INPUT)).resolves.not.toThrow();

    expect($transaction).not.toHaveBeenCalled();
    expect($executeRaw).toHaveBeenCalledTimes(2);
  });

  it('payment attempt not found → logs + returns without error, no dispute inserted', async () => {
    const $queryRaw = jest.fn().mockResolvedValueOnce([]); // no attempt
    const $executeRaw = jest.fn();
    const $transaction = jest.fn();
    const prisma = { $queryRaw, $executeRaw, $transaction } as unknown as PrismaService;
    const uc = new ProcessChargebackUseCase(prisma);

    await expect(uc.execute(BASE_INPUT)).resolves.not.toThrow();

    // No dispute insert, no transaction
    expect($executeRaw).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it('processes order in PAID status correctly', async () => {
    const prisma = makePrisma({ orderRows: [ORDER_PAID] });
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    // Transaction called for PAID orders too
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('within transaction: re-checks status under lock and skips if already CHARGEBACK', async () => {
    // The outer order query returns TICKETS_ISSUED, but under the lock it's already CHARGEBACK
    const chargebackUnderLock = { ...ORDER_TICKETS_ISSUED, status: 'CHARGEBACK' };

    const transactionFn = jest.fn().mockImplementation(
      async (
        fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => Promise<void>,
      ) => {
        const txQueryRaw = jest.fn().mockResolvedValueOnce([chargebackUnderLock]);
        const txExecuteRaw = jest.fn().mockResolvedValue(1);
        await fn({ $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw });
        // Verify no UPDATE was called inside the transaction (txExecuteRaw not called)
        expect(txExecuteRaw).not.toHaveBeenCalled();
      },
    );

    const prisma = makePrisma({ transactionFn });
    const uc = new ProcessChargebackUseCase(prisma);

    await uc.execute(BASE_INPUT);

    expect(transactionFn).toHaveBeenCalledTimes(1);
  });
});
