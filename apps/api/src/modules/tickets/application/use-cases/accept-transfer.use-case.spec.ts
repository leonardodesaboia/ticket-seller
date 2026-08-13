import * as nodeCrypto from 'node:crypto';
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

function buildUseCase({
  transfer = makeTransfer() as TicketTransfer | null,
  acceptAtomicallyResult = nodeCrypto.randomBytes(32).toString('hex') as string | Error,
}: {
  transfer?: TicketTransfer | null;
  acceptAtomicallyResult?: string | Error;
} = {}) {
  const transferRepo = {
    findByClaimTokenHash: jest.fn().mockResolvedValue(transfer),
    findPendingByTicketId: jest.fn(),
    create: jest.fn(),
    cancel: jest.fn(),
    accept: jest.fn(),
    acceptAtomically: jest.fn().mockImplementation(() => {
      if (acceptAtomicallyResult instanceof Error) {
        return Promise.reject(acceptAtomicallyResult);
      }
      return Promise.resolve(acceptAtomicallyResult);
    }),
  };

  const useCase = new AcceptTransferUseCase(transferRepo as never);
  return { useCase, transferRepo };
}

describe('AcceptTransferUseCase', () => {
  it('returns newCredentialToken on success', async () => {
    const token = nodeCrypto.randomBytes(32).toString('hex');
    const { useCase } = buildUseCase({ acceptAtomicallyResult: token });
    const result = await useCase.execute({ claimToken: CLAIM_TOKEN });
    expect(result.newCredentialToken).toBe(token);
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

  it('throws TransferAlreadyAcceptedError when concurrent accept changes status inside acceptAtomically', async () => {
    const { useCase } = buildUseCase({
      acceptAtomicallyResult: new TransferAlreadyAcceptedError(),
    });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TransferAlreadyAcceptedError,
    );
  });

  it('throws TicketAlreadyAdmittedError when ticket is admitted inside acceptAtomically', async () => {
    const { useCase } = buildUseCase({
      acceptAtomicallyResult: new TicketAlreadyAdmittedError(TICKET_ID),
    });
    await expect(useCase.execute({ claimToken: CLAIM_TOKEN })).rejects.toBeInstanceOf(
      TicketAlreadyAdmittedError,
    );
  });

  it('calls acceptAtomically with correct params', async () => {
    const token = nodeCrypto.randomBytes(32).toString('hex');
    const { useCase, transferRepo } = buildUseCase({ acceptAtomicallyResult: token });
    await useCase.execute({ claimToken: CLAIM_TOKEN });
    expect(transferRepo.acceptAtomically).toHaveBeenCalledTimes(1);
    expect(transferRepo.acceptAtomically).toHaveBeenCalledWith({
      transferId: TRANSFER_ID,
      ticketId: TICKET_ID,
      organizationId: ORG_ID,
    });
  });

  it('newCredentialToken is 64 hex chars (not the hash)', async () => {
    const token = nodeCrypto.randomBytes(32).toString('hex');
    const { useCase } = buildUseCase({ acceptAtomicallyResult: token });
    const result = await useCase.execute({ claimToken: CLAIM_TOKEN });
    const hash = nodeCrypto.createHash('sha256').update(result.newCredentialToken).digest('hex');
    // token should be different from its hash
    expect(result.newCredentialToken).not.toBe(hash);
    expect(result.newCredentialToken).toHaveLength(64);
  });
});
