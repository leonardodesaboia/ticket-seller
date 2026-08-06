import type { PublicEventListItem } from '@/shared/api/public-events.api';
import { EventCard } from './EventCard';

interface EventListProps {
  events: PublicEventListItem[];
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground" role="status">
        Nenhum evento publicado no momento.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.slug} event={event} />
      ))}
    </ul>
  );
}
