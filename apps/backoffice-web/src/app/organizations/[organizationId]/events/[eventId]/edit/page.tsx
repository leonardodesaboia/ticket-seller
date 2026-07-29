'use client';

import { useParams, useRouter } from 'next/navigation';
import { EditEventForm } from '../../../../../../features/events/components/EditEventForm';
import { useGetEvent } from '../../../../../../features/events/hooks/use-get-event';
import type { Event } from '../../../../../../features/events/types';

const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';

export default function EditEventPage() {
  const { organizationId, eventId } = useParams<{
    organizationId: string;
    eventId: string;
  }>();
  const router = useRouter();

  const { data: event, isLoading, error } = useGetEvent(organizationId, eventId, DEV_USER_ID);

  function handleSuccess(updated: Event) {
    router.push(`/organizations/${organizationId}/events/${updated.id}`);
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <p className="text-muted-foreground">Carregando evento...</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Evento não encontrado'}
        </p>
      </main>
    );
  }

  if (event.status !== 'DRAFT') {
    return (
      <main className="mx-auto max-w-lg p-8">
        <p className="text-destructive">
          Este evento não pode ser editado pois não está em rascunho.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Editar evento</h1>
      <EditEventForm
        event={event}
        organizationId={organizationId}
        devUserId={DEV_USER_ID}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
