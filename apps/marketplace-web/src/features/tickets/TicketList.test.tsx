import { render, screen } from '@testing-library/react';
import { TicketList } from './TicketList';
import type { TicketItem } from '@/shared/api/public-payments.api';

const makeTicket = (overrides: Partial<TicketItem> = {}): TicketItem => ({
  ticketId: 'ticket-1',
  ticketTypeId: 'type-1',
  orderItemId: 'item-1',
  unitIndex: 0,
  publicCode: 'abc123def456',
  status: 'ACTIVE',
  ...overrides,
});

describe('TicketList', () => {
  it('renders the empty state when no tickets are provided', () => {
    render(<TicketList tickets={[]} />);

    expect(screen.getByText('Nenhum ingresso encontrado.')).toBeInTheDocument();
  });

  it('renders each ticket with the correct publicCode', () => {
    const tickets = [
      makeTicket({ ticketId: 'ticket-1', publicCode: 'code-one', unitIndex: 0 }),
      makeTicket({ ticketId: 'ticket-2', publicCode: 'code-two', unitIndex: 1 }),
    ];

    render(<TicketList tickets={tickets} />);

    expect(screen.getByText('code-one')).toBeInTheDocument();
    expect(screen.getByText('code-two')).toBeInTheDocument();
  });

  it('sets the correct aria-label on each ticket item', () => {
    const tickets = [
      makeTicket({ ticketId: 'ticket-1', publicCode: 'abc-code', unitIndex: 0 }),
      makeTicket({ ticketId: 'ticket-2', publicCode: 'xyz-code', unitIndex: 1 }),
    ];

    render(<TicketList tickets={tickets} />);

    expect(
      screen.getByRole('listitem', { name: 'Código do ingresso 1: abc-code' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Código do ingresso 2: xyz-code' }),
    ).toBeInTheDocument();
  });

  it('displays the ticket status', () => {
    const tickets = [makeTicket({ status: 'ACTIVE', unitIndex: 0 })];

    render(<TicketList tickets={tickets} />);

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
  });
});
