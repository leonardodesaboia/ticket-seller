import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InitiateTransferModal } from './InitiateTransferModal';
import type { TicketItem } from '@/shared/api/public-payments.api';

const ticket: TicketItem = {
  ticketId: 'ticket-1',
  ticketTypeId: 'type-1',
  orderItemId: 'item-1',
  unitIndex: 0,
  publicCode: 'ABC123',
  status: 'ACTIVE',
};

const orderId = 'order-uuid';
const token = 'reservation-token';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('InitiateTransferModal', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('displays QR invalidation warning before confirming', () => {
    render(
      <InitiateTransferModal
        ticket={ticket}
        orderId={orderId}
        token={token}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/QR Code atual será invalidado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('shows the claim link after successful transfer initiation', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ claimToken: 'claim-abc-123', expiresAt: '2026-08-14T00:00:00Z' }),
    );

    render(
      <InitiateTransferModal
        ticket={ticket}
        orderId={orderId}
        token={token}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(screen.getByText(/claim-abc-123/)).toBeInTheDocument();
    });

    expect(screen.getByText('https://example.com/transfer/accept/claim-abc-123')).toBeInTheDocument();
  });

  it('calls navigator.clipboard.writeText when clicking Copiar link', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ claimToken: 'claim-token-xyz', expiresAt: '2026-08-14T00:00:00Z' }),
    );

    render(
      <InitiateTransferModal
        ticket={ticket}
        orderId={orderId}
        token={token}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/transfer/accept/claim-token-xyz',
    );
  });

  it('shows error message when API fails', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ code: 'INTERNAL_ERROR' }, false, 500),
    );

    render(
      <InitiateTransferModal
        ticket={ticket}
        orderId={orderId}
        token={token}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível iniciar a transferência. Tente novamente.',
    );
  });
});
