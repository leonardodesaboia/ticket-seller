import { render, screen, fireEvent } from '@testing-library/react';
import { TicketCard } from './TicketCard';
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

describe('TicketCard', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders publicCode and the transfer button', () => {
    render(<TicketCard ticket={ticket} orderId={orderId} token={token} />);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transferir' })).toBeInTheDocument();
  });

  it('shows the transfer modal when clicking Transferir', () => {
    render(<TicketCard ticket={ticket} orderId={orderId} token={token} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/QR Code atual será invalidado/)).toBeInTheDocument();
  });
});
