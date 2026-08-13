import { CancelOrderUseCase } from './cancel-order.use-case';
import { IOrderCancellationRepository } from '../ports/order-cancellation-repository.port';
import {
  InvalidReservationTokenError,
  OrderNotFoundForCancellationError,
} from '../../domain/cancellation.errors';

const makeRepo = (): jest.Mocked<IOrderCancellationRepository> => ({
  findForCancellation: jest.fn(),
  findForCancellationByToken: jest.fn(),
  hasAdmittedCheckInForOrder: jest.fn(),
  hasPendingTransferForOrder: jest.fn(),
  cancelPrePaymentOrder: jest.fn(),
  cancelPostPaymentOrder: jest.fn(),
});

const ORG = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORDER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const TOKEN = 'a'.repeat(64);

const pendingOrder = {
  id: ORDER_ID,
  organizationId: ORG,
  eventId: 'event-id',
  reservationId: 'res-id',
  status: 'PENDING_PAYMENT',
  totalAmount: BigInt(9900),
  currency: 'BRL',
  items: [{ ticketTypeId: 'tt-1', quantity: 1 }],
};

const issuedOrder = { ...pendingOrder, status: 'TICKETS_ISSUED' };

describe('CancelOrderUseCase', () => {
  let useCase: CancelOrderUseCase;
  let repo: jest.Mocked<IOrderCancellationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CancelOrderUseCase(repo);
  });

  describe('executeByToken (buyer path)', () => {
    it('cancels PENDING_PAYMENT order with valid token', async () => {
      repo.findForCancellationByToken.mockResolvedValue(pendingOrder);
      repo.cancelPrePaymentOrder.mockResolvedValue(undefined);

      const result = await useCase.executeByToken({ orderId: ORDER_ID, reservationToken: TOKEN });

      expect(result.status).toBe('CANCELLED');
      expect(result.requiresRefund).toBe(false);
      expect(result.ticketsCancelledCount).toBe(0);
      expect(repo.cancelPrePaymentOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: ORDER_ID, source: 'CUSTOMER' }),
      );
    });

    it('throws InvalidReservationTokenError when token is invalid / order not found', async () => {
      repo.findForCancellationByToken.mockResolvedValue(null);

      await expect(
        useCase.executeByToken({ orderId: ORDER_ID, reservationToken: TOKEN }),
      ).rejects.toBeInstanceOf(InvalidReservationTokenError);
    });

    it('throws NOT_CANCELLABLE for TICKETS_ISSUED (buyer cannot cancel post-payment)', async () => {
      repo.findForCancellationByToken.mockResolvedValue(issuedOrder);

      await expect(
        useCase.executeByToken({ orderId: ORDER_ID, reservationToken: TOKEN }),
      ).rejects.toMatchObject({ eligibilityCode: 'ORDER_IN_TERMINAL_STATE' });
    });

    it('throws ORDER_ALREADY_CANCELLED for idempotent re-cancel', async () => {
      repo.findForCancellationByToken.mockResolvedValue({ ...pendingOrder, status: 'CANCELLED' });

      await expect(
        useCase.executeByToken({ orderId: ORDER_ID, reservationToken: TOKEN }),
      ).rejects.toMatchObject({ eligibilityCode: 'ORDER_ALREADY_CANCELLED' });
    });
  });

  describe('executeByAdmin (admin path)', () => {
    it('cancels PENDING_PAYMENT order (admin)', async () => {
      repo.findForCancellation.mockResolvedValue(pendingOrder);
      repo.cancelPrePaymentOrder.mockResolvedValue(undefined);

      const result = await useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG, actorId: 'actor-1' });

      expect(result.status).toBe('CANCELLED');
      expect(result.requiresRefund).toBe(false);
      expect(repo.hasAdmittedCheckInForOrder).not.toHaveBeenCalled();
    });

    it('cancels TICKETS_ISSUED order with no blocking conditions', async () => {
      repo.findForCancellation.mockResolvedValue(issuedOrder);
      repo.hasAdmittedCheckInForOrder.mockResolvedValue(false);
      repo.hasPendingTransferForOrder.mockResolvedValue(false);
      repo.cancelPostPaymentOrder.mockResolvedValue({ cancelledTicketIds: ['t1', 't2'] });

      const result = await useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG });

      expect(result.status).toBe('CANCELLED');
      expect(result.requiresRefund).toBe(true);
      expect(result.ticketsCancelledCount).toBe(2);
    });

    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
      repo.findForCancellation.mockResolvedValue(null);

      await expect(
        useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG }),
      ).rejects.toBeInstanceOf(OrderNotFoundForCancellationError);
    });

    it('returns ORDER_ALREADY_CANCELLED for idempotent re-cancel', async () => {
      repo.findForCancellation.mockResolvedValue({ ...pendingOrder, status: 'CANCELLED' });

      await expect(
        useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG }),
      ).rejects.toMatchObject({ eligibilityCode: 'ORDER_ALREADY_CANCELLED' });
    });

    it('returns ORDER_IN_TERMINAL_STATE for EXPIRED order', async () => {
      repo.findForCancellation.mockResolvedValue({ ...pendingOrder, status: 'EXPIRED' });

      await expect(
        useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG }),
      ).rejects.toMatchObject({ eligibilityCode: 'ORDER_IN_TERMINAL_STATE' });
    });

    it('returns TICKET_ALREADY_USED when ADMITTED check-in exists', async () => {
      repo.findForCancellation.mockResolvedValue(issuedOrder);
      repo.hasAdmittedCheckInForOrder.mockResolvedValue(true);
      repo.hasPendingTransferForOrder.mockResolvedValue(false);

      await expect(
        useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG }),
      ).rejects.toMatchObject({ eligibilityCode: 'TICKET_ALREADY_USED' });
    });

    it('returns TICKET_TRANSFER_PENDING when transfer is pending', async () => {
      repo.findForCancellation.mockResolvedValue(issuedOrder);
      repo.hasAdmittedCheckInForOrder.mockResolvedValue(false);
      repo.hasPendingTransferForOrder.mockResolvedValue(true);

      await expect(
        useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG }),
      ).rejects.toMatchObject({ eligibilityCode: 'TICKET_TRANSFER_PENDING' });
    });

    it('does not check ticket state for PENDING_PAYMENT orders', async () => {
      repo.findForCancellation.mockResolvedValue(pendingOrder);
      repo.cancelPrePaymentOrder.mockResolvedValue(undefined);

      await useCase.executeByAdmin({ orderId: ORDER_ID, organizationId: ORG });

      expect(repo.hasAdmittedCheckInForOrder).not.toHaveBeenCalled();
      expect(repo.hasPendingTransferForOrder).not.toHaveBeenCalled();
    });
  });
});
