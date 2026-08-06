import type { PublicEventListItem } from '@/shared/api/public-events.api';
import { EventList } from './EventList';

interface CatalogHomeProps {
  events: PublicEventListItem[];
}

export function CatalogHome({ events }: CatalogHomeProps) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Ticket Seller</h1>
        <p className="text-lg text-muted-foreground">Eventos publicados</p>
      </header>
      <section aria-label="Eventos publicados">
        <EventList events={events} />
      </section>
    </main>
  );
}
