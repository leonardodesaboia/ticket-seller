'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EventList } from '../../../../features/events/components/EventList';
import { useListEvents } from '../../../../features/events/hooks/use-list-events';

export default function EventsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { events, nextCursor, isLoading, isFetching, error, loadMore } = useListEvents(
    organizationId,
  );

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Erro ao carregar eventos'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
        <Link
          href={`/organizations/${organizationId}/events/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Novo evento
        </Link>
      </div>

      <EventList
        events={events}
        organizationId={organizationId}
        nextCursor={nextCursor}
        isLoading={isLoading}
        isFetching={isFetching}
        onLoadMore={loadMore}
      />
    </main>
  );
}
