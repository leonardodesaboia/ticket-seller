import { render, screen } from '@testing-library/react';
import { EventDetails } from './EventDetails';
import type { PublicEventDetail } from '@/shared/api/public-events.api';

const baseEvent: PublicEventDetail = {
  slug: 'rock-fest',
  title: 'Rock Fest',
  description: 'A great show',
  format: 'IN_PERSON',
  startsAt: '2026-09-01T21:00:00.000Z',
  endsAt: '2026-09-01T23:00:00.000Z',
  timezone: 'America/Fortaleza',
  currency: 'BRL',
  venue: { name: 'Main Hall', city: 'Fortaleza', state: 'CE', country: 'BR' },
  ticketTypes: [{ ticketTypeId: '00000000-0000-4000-8000-000000000001', name: 'General', description: null, price: 5000, currency: 'BRL' }],
};

describe('EventDetails', () => {
  it('renders title, format, venue and BRL price', () => {
    render(<EventDetails event={baseEvent} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rock Fest');
    expect(screen.getByText('Presencial')).toBeInTheDocument();
    expect(screen.getByText(/Main Hall/)).toBeInTheDocument();
    expect(screen.getByText(/Fortaleza, CE, BR/)).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
  });

  it('omits the venue section for online events', () => {
    render(<EventDetails event={{ ...baseEvent, format: 'ONLINE', venue: null }} />);

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.queryByText('Onde')).not.toBeInTheDocument();
  });
});
