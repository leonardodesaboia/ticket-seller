'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EventConfigurationForm } from '../../../../../../features/events/components/EventConfigurationForm';
import { useGetEvent } from '../../../../../../features/events/hooks/use-get-event';
import { TicketTypeList } from '../../../../../../features/ticket-types/components/TicketTypeList';
import type { Event } from '../../../../../../features/events/types';

export default function EventConfigurationPage() {
  const { organizationId, eventId } = useParams<{
    organizationId: string;
    eventId: string;
  }>();

  const { data: event, isLoading, error, refetch } = useGetEvent(
    organizationId,
    eventId,
  );

  const [localEvent, setLocalEvent] = useState<Event | null>(null);
  const displayEvent = localEvent ?? event ?? null;

  function handleConfigurationSuccess(updated: Event) {
    setLocalEvent(updated);
    void refetch();
  }

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

  if (event.status !== 'DRAFT') {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive">
          A configuração só pode ser editada quando o evento está em rascunho.
        </p>
        <Link
          href={`/organizations/${organizationId}/events/${eventId}`}
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Voltar ao evento
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuração do evento</h1>
          <p className="mt-1 text-sm text-muted-foreground">{event.title}</p>
        </div>
        <Link
          href={`/organizations/${organizationId}/events/${eventId}`}
          className="text-sm text-primary underline"
        >
          Voltar
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Detalhes</h2>
        {displayEvent && (
          <EventConfigurationForm
            event={displayEvent}
            organizationId={organizationId}
            onSuccess={handleConfigurationSuccess}
          />
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Tipos de ingresso</h2>
        <TicketTypeList
          organizationId={organizationId}
          eventId={eventId}
          eventCurrency={displayEvent?.currency ?? null}
        />
      </section>
    </main>
  );
}
