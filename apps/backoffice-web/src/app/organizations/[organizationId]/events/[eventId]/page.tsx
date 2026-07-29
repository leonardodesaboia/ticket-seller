'use client';

import { useParams } from 'next/navigation';
import { EventDetail } from '../../../../../features/events';
import { useGetEvent } from '../../../../../features/events/hooks/use-get-event';

const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';

export default function EventPage() {
  const { organizationId, eventId } = useParams<{
    organizationId: string;
    eventId: string;
  }>();

  const { data: event, isLoading, error } = useGetEvent(organizationId, eventId, DEV_USER_ID);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-muted-foreground">Carregando evento...</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Evento não encontrado'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <EventDetail event={event} />
    </main>
  );
}
