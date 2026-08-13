import { AcceptTransferUseCase } from './accept-transfer.use-case';
import { TicketTransfer } from '../../domain/ticket-transfer.entity';
import {
  TransferNotFoundError,
  TransferExpiredError,
  TransferAlreadyAcceptedError,
  TicketAlreadyAdmittedError,
} from '../../domain/ticket-transfer.errors';

const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ORG_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const TRANSFER_ID = '22222222-2222-4222-2222-222222222222';
const CLAIM_TOKEN = 'd'.repeat(64);

function makeTransfer(overrides: {
  status?: string;
  expiresAt?: Date;
} = {}): TicketTransfer {
  return new TicketTransfer({
    id: TRANSFER_ID,
    ticketId: TICKET_ID,
    organizationId: ORG_ID,
    claimTokenHash: 'c'.repeat(64),
    status: (overrides.status ?? 'PENDING') as 'PENDING' | 'ACCEPTED' | 'CANCELLED',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86400000),
    acceptedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
  });
}

function buildTxMock({
  ticketRows = [{ id: TICKET_ID }] as Array<{ id: string }>,
  transferRows = [{ status: 'PENDING' }] as Array<{ status: string }>,
  admittedRows = [] as Array<{ id: string }>,
  maxVersionRows = [{ max_version: 1 }] as Array<{ max_version: number | null }>,
}: {
  ticketRows?: Array<{ id: string }>;
  transferRows?: Array<{ status: string }>;
  admittedRows?: Array<{ id: string }>;
  maxVersionRows?: Array<{ max_version: number | null }>;
} = {}) {
  // $queryRaw returns different results based on call sequence
  let callCount = 0;
  const $queryRaw = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(ticketRows);       // SELECT FOR UPDATE
    if (callCount === 2) return Promise.resolve(transferRows);      // SELECT status
    if (callCount === 3) return Promise.resolve(admittedRows);      // check admitted
    if (callCount === 4) return Promise.resolve(maxVersionRows);    // MAX(version)
    return Promise.resolve([]);
  });
  const $executeRaw = jest.fn().mockResolvedValue(1);
  return { $queryRaw, $executeRaw };
}

function buildUseCase({
  transfer = makeTransfer() as TicketTransfer | null,
  txMockConfig = {} as Parameters<typeof buildTxMock>[0],
}: {
  transfer?: TicketTransfer | null;
  txMockConfig?: Parameters<typeof buildTxMock>[0];
} = {}) {
  const transferRepo = {
    findByClaimTokenHash: jest.fn().mockResolvedValue(transfer),
    findPendingByTicketId: jest.fn(),
    create: jest.fn(),
    cancel: jest.fn(),
    accept: jest.fn(),
  };

  const txMock = buildTxMock(txMockConfig);
  const prisma = {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) => {
      await fn(txMock);
    }),
  };

  const useCase = new AcceptTransferUseCase(transferRepo as never, prisma as never);
  return { useCase, transferRepo, prisma, txMock };
}

describe('AcceptTransferUseCase', () => {
  it('returns newCredentialToken on success', async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.execute({ claimToken: CLAIM_TOKEN });
    expect(result.newCredentialToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws TransferNotFoundError when no transfer matches hash', async () => {
    const { useCase } = buildUseCase({ transfer: null });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TransferNotFoundError,
    );
  });

  it('throws TransferExpiredError when transfer is expired', async () => {
    const expired = makeTransfer({ expiresAt: new Date(Date.now() - 1000) });
    const { useCase } = buildUseCase({ transfer: expired });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TransferExpiredError,
    );
  });

  it('throws TransferAlreadyAcceptedError when transfer status is ACCEPTED', async () => {
    const accepted = makeTransfer({ status: 'ACCEPTED' });
    const { useCase } = buildUseCase({ transfer: accepted });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TransferAlreadyAcceptedError,
    );
  });

  it('throws TransferAlreadyAcceptedError when concurrent accept changes status inside tx', async () => {
    const { useCase } = buildUseCase({
      txMockConfig: { transferRows: [{ status: 'ACCEPTED' }] },
    });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TransferAlreadyAcceptedError,
    );
  });

  it('throws TicketAlreadyAdmittedError when ticket is admitted inside tx', async () => {
    const { useCase } = buildUseCase({
      txMockConfig: { admittedRows: [{ id: 'checkin-id' }] },
    });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TicketAlreadyAdmittedError,
    );
  });

  it('executes within a transaction', async () => {
    const { useCase, prisma } = buildUseCase();
    await useCase.execute({ claimToken: CLAIM_TOKEN });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('newCredentialToken is 64 hex chars (not the hash)', async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.execute({ claimToken: CLAIM_TOKEN });
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(result.newCredentialToken).digest('hex');
    // token should be different from its hash
    expect(result.newCredentialToken).not.toBe(hash);
    expect(result.newCredentialToken).toHaveLength(64);
  });
});
