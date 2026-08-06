import { render, screen } from '@testing-library/react';
import { EventCard } from './EventCard';
import type { PublicEventListItem } from '@/shared/api/public-events.api';

const event: PublicEventListItem = {
  slug: 'rock-fest',
  title: 'Rock Fest',
  format: 'HYBRID',
  startsAt: '2026-09-01T21:00:00.000Z',
  endsAt: '2026-09-01T23:00:00.000Z',
  timezone: 'America/Fortaleza',
  currency: 'BRL',
};

describe('EventCard', () => {
  it('links to the event detail page and shows the format', () => {
    render(
      <ul>
        <EventCard event={event} />
      </ul>,
    );

    expect(screen.getByRole('link', { name: /Rock Fest/ })).toHaveAttribute(
      'href',
      '/events/rock-fest',
    );
    expect(screen.getByText('Híbrido')).toBeInTheDocument();
  });
});
