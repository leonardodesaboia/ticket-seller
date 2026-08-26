import { render, screen } from '@testing-library/react';
import { ConfirmationView } from './ConfirmationView';

const orderId = '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048';
const token = 'reservation-token';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const ticketsPayload = {
  orderId,
  tickets: [
    {
      ticketId: 'ticket-1',
      ticketTypeId: 'type-1',
      orderItemId: 'item-1',
      unitIndex: 0,
      publicCode: 'abc123',
      status: 'ACTIVE',
    },
    {
      ticketId: 'ticket-2',
      ticketTypeId: 'type-1',
      orderItemId: 'item-1',
      unitIndex: 1,
      publicCode: 'def456',
      status: 'ACTIVE',
    },
  ],
};

describe('ConfirmationView', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially then renders tickets', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(ticketsPayload));

    render(<ConfirmationView orderId={orderId} token={token} />);

    expect(screen.getByText('Carregando ingressos…')).toBeInTheDocument();
    expect(await screen.findByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('def456')).toBeInTheDocument();
  });

  it('renders the confirmation heading', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(ticketsPayload));

    render(<ConfirmationView orderId={orderId} token={token} />);

    expect(await screen.findByRole('heading', { name: 'Pagamento confirmado!' })).toBeInTheDocument();
    expect(screen.getByText('Seus ingressos foram emitidos.')).toBeInTheDocument();
  });

  it('shows an aria-label on each ticket item', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(ticketsPayload));

    render(<ConfirmationView orderId={orderId} token={token} />);

    expect(
      await screen.findByRole('listitem', { name: 'Código do ingresso 1: abc123' }),
    ).toBeInTheDocument();
  });

  it('displays an error when the tickets fetch fails', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({ code: 'INTERNAL' }, false, 500));

    render(<ConfirmationView orderId={orderId} token={token} />);

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Não foi possível carregar seus ingressos.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('sends the reservation token in the tickets request', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(ticketsPayload));

    render(<ConfirmationView orderId={orderId} token={token} />);

    await screen.findByText('abc123');

    expect(jest.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'X-Reservation-Token': token }),
    });
  });
});
