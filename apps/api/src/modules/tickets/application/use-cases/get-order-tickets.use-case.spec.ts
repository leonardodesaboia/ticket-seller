import { GetOrderTicketsUseCase } from './get-order-tickets.use-case';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { Ticket } from '../../domain/ticket.entity';
import { ITicketRepository } from '../../domain/ports/ticket-repository.port';
import { ITicketOrderAccessPort } from '../ports/ticket-order-access.port';

function makeTicket(): Ticket {
  return new Ticket({
    id: 'tkt-1', organizationId: 'org-1', eventId: 'evt-1', orderId: 'order-1',
    orderItemId: 'item-1', ticketTypeId: 'tt-1', unitIndex: 0,
    publicCode: 'a'.repeat(64), status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
  });
}

describe('GetOrderTicketsUseCase', () => {
  const orderAccess: ITicketOrderAccessPort = {
    findOrderWithToken: jest.fn(),
  };
  const ticketRepo: ITicketRepository = {
    createIfNotExists: jest.fn(),
    findByOrderId: jest.fn().mockResolvedValue([makeTicket()]),
  };
  const useCase = new GetOrderTicketsUseCase(ticketRepo, orderAccess);

  beforeEach(() => jest.clearAllMocks());

  it('throws TicketInvalidTokenError when token is invalid', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce(null);
    await expect(useCase.execute('order-1', 'bad-token')).rejects.toThrow(TicketInvalidTokenError);
  });

  it('returns tickets when token is valid', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce({ id: 'order-1', organizationId: 'org-1', status: 'TICKETS_ISSUED' });
    const result = await useCase.execute('order-1', 'valid-token');
    expect(result).toHaveLength(1);
    expect(ticketRepo.findByOrderId).toHaveBeenCalledWith('order-1', 'org-1');
  });

  it('returns empty array when order has no tickets yet', async () => {
    (orderAccess.findOrderWithToken as jest.Mock).mockResolvedValueOnce({ id: 'order-1', organizationId: 'org-1', status: 'PAID' });
    (ticketRepo.findByOrderId as jest.Mock).mockResolvedValueOnce([]);
    const result = await useCase.execute('order-1', 'valid-token');
    expect(result).toHaveLength(0);
  });
});
