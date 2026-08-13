import { InitiateTransferUseCase } from './initiate-transfer.use-case';
import { TicketTransfer } from '../../domain/ticket-transfer.entity';
import { Ticket } from '../../domain/ticket.entity';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import {
  TicketAlreadyAdmittedError,
  TransferAlreadyPendingError,
} from '../../domain/ticket-transfer.errors';

const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ORDER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const ORG_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const TOKEN = 'a'.repeat(64);

function makeTicket(overrides: Partial<{ id: string; status: string }> = {}): Ticket {
  return new Ticket({
    id: overrides.id ?? TICKET_ID,
    organizationId: ORG_ID,
    eventId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
    orderId: ORDER_ID,
    orderItemId: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
    ticketTypeId: '11111111-1111-4111-1111-111111111111',
    unitIndex: 0,
    publicCode: 'b'.repeat(64),
    status: (overrides.status ?? 'ACTIVE') as 'ACTIVE' | 'CANCELLED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeTransfer(): TicketTransfer {
  return new TicketTransfer({
    id: '22222222-2222-4222-2222-222222222222',
    ticketId: TICKET_ID,
    organizationId: ORG_ID,
    claimTokenHash: 'c'.repeat(64),
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000),
    acceptedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
  });
}

function buildUseCase({
  orderResult = { id: ORDER_ID, organizationId: ORG_ID, status: 'PAID' },
  tickets = [makeTicket()],
  hasAdmittedCheckIn = false,
  pendingTransfer = null as TicketTransfer | null,
  createResult = makeTransfer(),
}: {
  orderResult?: { id: string; organizationId: string; status: string } | null;
  tickets?: Ticket[];
  hasAdmittedCheckIn?: boolean;
  pendingTransfer?: TicketTransfer | null;
  createResult?: TicketTransfer;
} = {}) {
  const orderAccess = {
    findOrderWithToken: jest.fn().mockResolvedValue(orderResult),
  };
  const ticketRepo = {
    findByOrderId: jest.fn().mockResolvedValue(tickets),
    createIfNotExists: jest.fn(),
  };
  const transferRepo = {
    findPendingByTicketId: jest.fn().mockResolvedValue(pendingTransfer),
    findByClaimTokenHash: jest.fn(),
    create: jest.fn().mockResolvedValue(createResult),
    cancel: jest.fn(),
    accept: jest.fn(),
    acceptAtomically: jest.fn(),
  };
  const checkInAccess = {
    hasAdmittedCheckIn: jest.fn().mockResolvedValue(hasAdmittedCheckIn),
  };

  const useCase = new InitiateTransferUseCase(
    transferRepo as never,
    orderAccess as never,
    ticketRepo as never,
    checkInAccess as never,
  );

  return { useCase, orderAccess, ticketRepo, transferRepo, checkInAccess };
}

describe('InitiateTransferUseCase', () => {
  it('returns claimToken and expiresAt on success', async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.execute({
      orderId: ORDER_ID,
      ticketId: TICKET_ID,
      reservationToken: TOKEN,
    });
    expect(result.claimToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('throws TicketInvalidTokenError when order not found', async () => {
    const { useCase } = buildUseCase({ orderResult: null });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TicketInvalidTokenError);
  });

  it('throws TicketInvalidTokenError when ticket not in order', async () => {
    const otherTicket = makeTicket({ id: '33333333-3333-4333-3333-333333333333' });
    const { useCase } = buildUseCase({ tickets: [otherTicket] });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TicketInvalidTokenError);
  });

  it('throws TicketAlreadyAdmittedError when check-in exists', async () => {
    const { useCase } = buildUseCase({ hasAdmittedCheckIn: true });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TicketAlreadyAdmittedError);
  });

  it('throws TransferAlreadyPendingError when PENDING transfer exists', async () => {
    const { useCase } = buildUseCase({ pendingTransfer: makeTransfer() });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TransferAlreadyPendingError);
  });

  it('creates transfer with SHA-256 hash, not plaintext token', async () => {
    const { useCase, transferRepo } = buildUseCase();
    const result = await useCase.execute({
      orderId: ORDER_ID,
      ticketId: TICKET_ID,
      reservationToken: TOKEN,
    });
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(result.claimToken).digest('hex');
    const createCall = transferRepo.create.mock.calls[0][0] as { claimTokenHash: string };
    expect(createCall.claimTokenHash).toBe(hash);
    expect(createCall.claimTokenHash).not.toBe(result.claimToken);
  });
});
