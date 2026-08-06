import { render, screen } from '@testing-library/react';
import { CatalogHome } from '@/features/public-event-catalog';
import type { PublicEventListItem } from '@/shared/api/public-events.api';

const event: PublicEventListItem = {
  slug: 'rock-fest',
  title: 'Rock Fest',
  format: 'IN_PERSON',
  startsAt: '2026-09-01T21:00:00.000Z',
  endsAt: '2026-09-01T23:00:00.000Z',
  timezone: 'America/Fortaleza',
  currency: 'BRL',
};

describe('Home page (CatalogHome)', () => {
  it('renders the brand heading', () => {
    render(<CatalogHome events={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ticket Seller');
  });

  it('lists published events with a link to the detail page', () => {
    render(<CatalogHome events={[event]} />);
    const link = screen.getByRole('link', { name: /Rock Fest/ });
    expect(link).toHaveAttribute('href', '/events/rock-fest');
  });

  it('shows an empty state when there are no events', () => {
    render(<CatalogHome events={[]} />);
    expect(screen.getByText(/Nenhum evento publicado/)).toBeInTheDocument();
  });
});
