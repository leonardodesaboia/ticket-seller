import { IssueTicketsUseCase } from './issue-tickets.use-case';
import { Ticket } from '../../domain/ticket.entity';
import { ITicketRepository, CreateTicketData } from '../../domain/ports/ticket-repository.port';
import { IOrderItemsAccessPort } from '../ports/order-items-access.port';

function makeTicket(overrides: Partial<ConstructorParameters<typeof Ticket>[0]> = {}): Ticket {
  return new Ticket({
    id: 'tkt-1', organizationId: 'org-1', eventId: 'evt-1', orderId: 'order-1',
    orderItemId: 'item-1', ticketTypeId: 'tt-1', unitIndex: 0,
    publicCode: 'a'.repeat(64),
    status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  });
}

describe('IssueTicketsUseCase', () => {
  const ticketRepo: ITicketRepository = {
    createIfNotExists: jest.fn().mockImplementation((__data: CreateTicketData) => { void __data; return makeTicket(); }),
    findByOrderId: jest.fn(),
  };
  const orderItemsAccess: IOrderItemsAccessPort = {
    findOrderWithItems: jest.fn(),
  };
  const useCase = new IssueTicketsUseCase(ticketRepo, orderItemsAccess);

  beforeEach(() => jest.clearAllMocks());

  it('creates N tickets for item with quantity N', async () => {
    const result = await useCase.executeWithItems({
      orderId: 'order-1', organizationId: 'org-1', eventId: 'evt-1',
      items: [{ orderItemId: 'item-1', ticketTypeId: 'tt-1', quantity: 3 }],
    });
    expect(result).toHaveLength(3);
    expect(ticketRepo.createIfNotExists).toHaveBeenCalledTimes(3);
  });

  it('creates tickets for multiple items', async () => {
    const result = await useCase.executeWithItems({
      orderId: 'order-1', organizationId: 'org-1', eventId: 'evt-1',
      items: [
        { orderItemId: 'item-1', ticketTypeId: 'tt-1', quantity: 2 },
        { orderItemId: 'item-2', ticketTypeId: 'tt-2', quantity: 1 },
      ],
    });
    expect(result).toHaveLength(3);
    expect(ticketRepo.createIfNotExists).toHaveBeenCalledTimes(3);
  });

  it('calls createIfNotExists with correct unitIndex values', async () => {
    await useCase.executeWithItems({
      orderId: 'order-1', organizationId: 'org-1', eventId: 'evt-1',
      items: [{ orderItemId: 'item-1', ticketTypeId: 'tt-1', quantity: 2 }],
    });
    const calls = (ticketRepo.createIfNotExists as jest.Mock).mock.calls as Array<[CreateTicketData]>;
    expect(calls[0]![0].unitIndex).toBe(0);
    expect(calls[1]![0].unitIndex).toBe(1);
  });

  it('skips null results from createIfNotExists (ON CONFLICT DO NOTHING)', async () => {
    (ticketRepo.createIfNotExists as jest.Mock)
      .mockResolvedValueOnce(makeTicket())
      .mockResolvedValueOnce(null);
    const result = await useCase.executeWithItems({
      orderId: 'order-1', organizationId: 'org-1', eventId: 'evt-1',
      items: [{ orderItemId: 'item-1', ticketTypeId: 'tt-1', quantity: 2 }],
    });
    expect(result).toHaveLength(1);
  });

  it('returns empty array when order not found in executeForOrder', async () => {
    (orderItemsAccess.findOrderWithItems as jest.Mock).mockResolvedValueOnce(null);
    const result = await useCase.executeForOrder('unknown-order');
    expect(result).toHaveLength(0);
  });
});
