import { IssueTicketCredentialUseCase } from './issue-ticket-credential.use-case';
import { TicketInvalidTokenError } from '../../domain/ticket.errors';
import { TicketCancelledError } from '../../domain/ticket-credential.errors';
import { Ticket } from '../../domain/ticket.entity';
import { TicketCredential } from '../../domain/ticket-credential.entity';

function makeTicket(id = 'tkt-1', status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE'): Ticket {
  return new Ticket({
    id,
    organizationId: 'org-1',
    eventId: 'evt-1',
    orderId: 'order-1',
    orderItemId: 'item-1',
    ticketTypeId: 'tt-1',
    unitIndex: 0,
    publicCode: 'a'.repeat(64),
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCredential(version = 1): TicketCredential {
  return new TicketCredential({
    id: 'cred-1',
    ticketId: 'tkt-1',
    organizationId: 'org-1',
    tokenHash: 'b'.repeat(64),
    status: 'ACTIVE',
    version,
    issuedAt: new Date(),
    revokedAt: null,
  });
}

describe('IssueTicketCredentialUseCase', () => {
  const orderAccess: any = { findOrderWithToken: jest.fn() };
  const ticketRepo: any = { findByOrderId: jest.fn() };
  const credentialRepo: any = {
    findActiveByTicketId: jest.fn(),
    createIfNoneActive: jest.fn(),
    rotateCredential: jest.fn(),
  };

  const useCase = new IssueTicketCredentialUseCase(credentialRepo, orderAccess, ticketRepo);

  beforeEach(() => jest.clearAllMocks());

  it('throws TicketInvalidTokenError when order token is invalid', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ orderId: 'o1', ticketId: 't1', reservationToken: 'bad' }),
    ).rejects.toThrow(TicketInvalidTokenError);
  });

  it('throws TicketInvalidTokenError when ticket does not belong to order', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('other-tkt')]);
    await expect(
      useCase.execute({ orderId: 'o1', ticketId: 'tkt-1', reservationToken: 'tok' }),
    ).rejects.toThrow(TicketInvalidTokenError);
  });

  it('throws TicketCancelledError when ticket is cancelled', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('tkt-1', 'CANCELLED')]);
    await expect(
      useCase.execute({ orderId: 'o1', ticketId: 'tkt-1', reservationToken: 'tok' }),
    ).rejects.toThrow(TicketCancelledError);
  });

  it('creates new credential when none exists', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('tkt-1')]);
    credentialRepo.findActiveByTicketId.mockResolvedValueOnce(null);
    credentialRepo.createIfNoneActive.mockResolvedValueOnce(makeCredential(1));

    const result = await useCase.execute({
      orderId: 'o1',
      ticketId: 'tkt-1',
      reservationToken: 'tok',
    });
    expect(result.credentialToken).toHaveLength(64);
    expect(credentialRepo.createIfNoneActive).toHaveBeenCalledTimes(1);
  });

  it('rotates credential and bumps version when active credential already exists', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('tkt-1')]);
    credentialRepo.findActiveByTicketId.mockResolvedValueOnce(makeCredential(1));
    credentialRepo.rotateCredential.mockResolvedValueOnce(makeCredential(2));

    const result = await useCase.execute({
      orderId: 'o1',
      ticketId: 'tkt-1',
      reservationToken: 'tok',
    });
    expect(credentialRepo.rotateCredential).toHaveBeenCalledTimes(1);
    expect(result.credentialToken).toHaveLength(64);
  });

  it('credentialToken is 64 hex chars and not equal to tokenHash', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('tkt-1')]);
    credentialRepo.findActiveByTicketId.mockResolvedValueOnce(null);
    credentialRepo.createIfNoneActive.mockResolvedValueOnce(makeCredential(1));

    const result = await useCase.execute({
      orderId: 'o1',
      ticketId: 'tkt-1',
      reservationToken: 'tok',
    });
    expect(result.credentialToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.credentialToken).not.toBe(result.credential.tokenHash);
  });

  it('falls back to rotateCredential when createIfNoneActive returns null (race condition)', async () => {
    orderAccess.findOrderWithToken.mockResolvedValueOnce({
      id: 'order-1',
      organizationId: 'org-1',
      status: 'TICKETS_ISSUED',
    });
    ticketRepo.findByOrderId.mockResolvedValueOnce([makeTicket('tkt-1')]);
    credentialRepo.findActiveByTicketId.mockResolvedValueOnce(null);
    credentialRepo.createIfNoneActive.mockResolvedValueOnce(null); // conflict
    credentialRepo.rotateCredential.mockResolvedValueOnce(makeCredential(2));

    const result = await useCase.execute({
      orderId: 'o1',
      ticketId: 'tkt-1',
      reservationToken: 'tok',
    });
    expect(credentialRepo.rotateCredential).toHaveBeenCalledTimes(1);
    expect(result.credentialToken).toHaveLength(64);
  });
});
