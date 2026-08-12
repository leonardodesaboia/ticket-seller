import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckoutPage } from './CheckoutPage';

const replace = jest.fn();
const router = { replace };

jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const reservationId = 'd61805ca-1d0c-42ca-8627-5b5914d12c29';
const orderId = '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048';
const reservation = { reservationId, status: 'ACTIVE', expiresAt: '2027-08-11T12:15:00.000Z', currency: 'BRL', subtotalAmount: 5000, items: [] };
const order = {
  orderId, reservationId, status: 'PENDING_PAYMENT', currency: 'BRL', subtotalAmount: 5000,
  totalAmount: 5500, expiresAt: '2027-08-11T12:15:00.000Z',
  items: [{ ticketTypeId: '4d3ce4d5-b7c3-4806-a290-31d6ac8690d4', name: 'Inteira', quantity: 1, unitPriceAmount: 5000, subtotalAmount: 5000 }],
};

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

// Third fetch: GET /orders/:id/payments/latest returns 404 (no attempt yet)
const noAttempt = response(null, false, 404);

describe('CheckoutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(`reservation_token_${reservationId}`, 'reservation-token');
    sessionStorage.setItem(`reservation_event_${reservationId}`, 'summer-fest');
    global.fetch = jest.fn();
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue('4671a36a-6198-4399-b355-8fb7bc1cfc29') });
  });

  it('creates an order on arrival and renders the backend order totals with payment method selection', async () => {
    jest.mocked(fetch)
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response(order, true, 201))
      .mockResolvedValueOnce(noAttempt); // GET /payments/latest → 404

    render(<CheckoutPage reservationId={reservationId} />);

    expect(screen.getByText('Preparando seu checkout…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByText('1× Inteira')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00 cada')).toBeInTheDocument();
    expect(screen.getByText('R$ 55,00')).toBeInTheDocument();
    // Payment method selection should be shown
    expect(screen.getByRole('button', { name: 'Pagar com PIX' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(jest.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ headers: expect.objectContaining({ 'X-Reservation-Token': 'reservation-token' }) });
  });

  it('shows an error and retries order preparation', async () => {
    jest.mocked(fetch)
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response({ code: 'UNEXPECTED' }, false, 500))
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response(order, true, 201))
      .mockResolvedValueOnce(noAttempt); // GET /payments/latest on retry
    render(<CheckoutPage reservationId={reservationId} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível preparar seu checkout. Tente novamente.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('clears the session and links back to the event when the reservation has expired', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({ code: 'RESERVATION_EXPIRED' }, false, 410));
    render(<CheckoutPage reservationId={reservationId} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sua reserva expirou. Selecione seus ingressos novamente.');
    expect(screen.getByRole('link', { name: 'Voltar ao evento' })).toHaveAttribute('href', '/events/summer-fest');
    expect(sessionStorage.getItem(`reservation_token_${reservationId}`)).toBeNull();
  });

  it('redirects when the reservation token is absent from the current session', async () => {
    sessionStorage.clear();
    render(<CheckoutPage reservationId={reservationId} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('goes directly to confirmation when order status is TICKETS_ISSUED', async () => {
    const issuedOrder = { ...order, status: 'TICKETS_ISSUED' };
    const ticketsPayload = { orderId, tickets: [{ ticketId: 't1', ticketTypeId: 'type-1', orderItemId: 'item-1', unitIndex: 0, publicCode: 'abc123', status: 'ACTIVE' }] };

    jest.mocked(fetch)
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response(issuedOrder, true, 201))
      .mockResolvedValueOnce(response(ticketsPayload)); // GET /tickets

    render(<CheckoutPage reservationId={reservationId} />);

    expect(await screen.findByRole('heading', { name: 'Pagamento confirmado!' })).toBeInTheDocument();
    expect(await screen.findByText('abc123')).toBeInTheDocument();
  });

  it('shows PIX instructions after selecting PIX payment', async () => {
    const pixAttempt = {
      paymentAttemptId: 'attempt-1',
      orderId,
      provider: 'FAKE',
      status: 'PENDING',
      paymentMethod: 'FAKE_PIX',
      amount: 5500,
      currency: 'BRL',
      expiresAt: '2027-08-11T12:15:00.000Z',
      checkoutData: { type: 'PIX', qrCodeText: 'pix-qr-text-here' },
    };

    jest.mocked(fetch)
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response(order, true, 201))
      .mockResolvedValueOnce(noAttempt) // GET /payments/latest
      .mockResolvedValueOnce(response(pixAttempt, true, 201)); // POST /payments

    render(<CheckoutPage reservationId={reservationId} />);

    const pixButton = await screen.findByRole('button', { name: 'Pagar com PIX' });
    fireEvent.click(pixButton);

    expect(await screen.findByText('pix-qr-text-here')).toBeInTheDocument();
  });

  it('shows an active PIX attempt immediately on page load without requiring method selection', async () => {
    const pendingAttempt = {
      paymentAttemptId: 'attempt-1',
      orderId,
      provider: 'FAKE',
      status: 'PENDING',
      paymentMethod: 'FAKE_PIX',
      amount: 5500,
      currency: 'BRL',
      expiresAt: '2027-08-11T12:15:00.000Z',
      checkoutData: { type: 'PIX', qrCodeText: 'pix-qr-text-here' },
    };

    jest.mocked(fetch)
      .mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response(order, true, 201))
      .mockResolvedValueOnce(response(pendingAttempt)); // GET /payments/latest → has active attempt

    render(<CheckoutPage reservationId={reservationId} />);

    expect(await screen.findByText('pix-qr-text-here')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar com PIX' })).not.toBeInTheDocument();
  });
});
