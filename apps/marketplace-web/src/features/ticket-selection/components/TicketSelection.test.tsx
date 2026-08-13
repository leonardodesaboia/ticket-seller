import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TicketSelection } from './TicketSelection';

const push = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ticketTypes = [
  { ticketTypeId: '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048', name: 'Inteira', description: 'Entrada geral', price: 5000, currency: 'BRL' },
  { ticketTypeId: 'd61805ca-1d0c-42ca-8627-5b5914d12c29', name: 'Meia', description: null, price: 2500, currency: 'BRL' },
];

function availabilityResponse(items: Array<{ ticketTypeId: string; availableQuantity: number }>) {
  return { ok: true, json: async () => ({ eventSlug: 'summer-fest', items }) } as Response;
}

describe('TicketSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue('4671a36a-6198-4399-b355-8fb7bc1cfc29') });
  });

  it('updates quantities and the visual subtotal, with accessible quantity controls', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(availabilityResponse([
      { ticketTypeId: ticketTypes[0]!.ticketTypeId, availableQuantity: 2 },
      { ticketTypeId: ticketTypes[1]!.ticketTypeId, availableQuantity: 1 },
    ]));
    render(<TicketSelection eventSlug="summer-fest" currency="BRL" ticketTypes={ticketTypes} />);

    const increase = await screen.findByRole('button', { name: 'Aumentar quantidade de Inteira' });
    expect(screen.getByRole('button', { name: 'Reservar ingressos' })).toBeDisabled();
    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(screen.getByLabelText('Quantidade selecionada de Inteira')).toHaveTextContent('2');
    expect(screen.getByText('Subtotal visual: R$ 100,00')).toBeInTheDocument();
    expect(increase).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Diminuir quantidade de Inteira' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reservar ingressos' })).toBeEnabled();
  });

  it('disables the selector for unavailable ticket types', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(availabilityResponse([
      { ticketTypeId: ticketTypes[0]!.ticketTypeId, availableQuantity: 0 },
      { ticketTypeId: ticketTypes[1]!.ticketTypeId, availableQuantity: 1 },
    ]));
    render(<TicketSelection eventSlug="summer-fest" currency="BRL" ticketTypes={ticketTypes} />);

    expect(await screen.findByText('Indisponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aumentar quantidade de Inteira' })).toBeDisabled();
  });

  it('prevents a second reservation request while the first one is pending', async () => {
    let resolveReservation: ((value: Response) => void) | undefined;
    jest.mocked(fetch)
      .mockResolvedValueOnce(availabilityResponse([{ ticketTypeId: ticketTypes[0]!.ticketTypeId, availableQuantity: 1 }]))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveReservation = resolve; }));
    render(<TicketSelection eventSlug="summer-fest" currency="BRL" ticketTypes={ticketTypes} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aumentar quantidade de Inteira' }));
    const reserve = screen.getByRole('button', { name: 'Reservar ingressos' });
    fireEvent.click(reserve);
    fireEvent.click(reserve);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reserve).toBeDisabled();

    const continuationToken = ['test', 'reservation', 'continuation'].join('-');
    resolveReservation?.({ ok: true, json: async () => ({ reservationId: 'd61805ca-1d0c-42ca-8627-5b5914d12c29', token: continuationToken, status: 'ACTIVE', expiresAt: '2026-08-11T12:15:00.000Z', currency: 'BRL', subtotalAmount: 5000, items: [] }) } as Response);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/checkout/d61805ca-1d0c-42ca-8627-5b5914d12c29'));
  });
});
