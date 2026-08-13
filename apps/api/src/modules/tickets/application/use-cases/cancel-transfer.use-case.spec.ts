import { CancelTransferUseCase } from './cancel-transfer.use-case';
import { TicketTransfer } from '../../domain/ticket-transfer.entity';
import { Ticket } from '../../domain/ticket.entity';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TransferNotFoundError } from '../../domain/ticket-transfer.errors';

const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ORDER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const ORG_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const TOKEN = 'a'.repeat(64);

function makeTicket(): Ticket {
  return new Ticket({
    id: TICKET_ID,
    organizationId: ORG_ID,
    eventId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
    orderId: ORDER_ID,
    orderItemId: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
    ticketTypeId: '11111111-1111-4111-1111-111111111111',
    unitIndex: 0,
    publicCode: 'b'.repeat(64),
    status: 'ACTIVE',
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
  pendingTransfer = makeTransfer() as TicketTransfer | null,
}: {
  orderResult?: { id: string; organizationId: string; status: string } | null;
  tickets?: Ticket[];
  pendingTransfer?: TicketTransfer | null;
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
    create: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
    accept: jest.fn(),
  };

  const useCase = new CancelTransferUseCase(
    transferRepo as never,
    orderAccess as never,
    ticketRepo as never,
  );

  return { useCase, orderAccess, ticketRepo, transferRepo };
}

describe('CancelTransferUseCase', () => {
  it('cancels a pending transfer successfully', async () => {
    const { useCase, transferRepo } = buildUseCase();
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).resolves.toBeUndefined();
    expect(transferRepo.cancel).toHaveBeenCalledWith('22222222-2222-4222-2222-222222222222');
  });

  it('throws TicketInvalidTokenError when order not found', async () => {
    const { useCase } = buildUseCase({ orderResult: null });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TicketInvalidTokenError);
  });

  it('throws TransferNotFoundError when no pending transfer exists', async () => {
    const { useCase } = buildUseCase({ pendingTransfer: null });
    await expect(
      useCase.execute({ orderId: ORDER_ID, ticketId: TICKET_ID, reservationToken: TOKEN }),
    ).rejects.toBeInstanceOf(TransferNotFoundError);
  });
});
