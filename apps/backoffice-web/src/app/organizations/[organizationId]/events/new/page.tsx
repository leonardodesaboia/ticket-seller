'use client';

import { useParams, useRouter } from 'next/navigation';
import { CreateEventForm } from '../../../../../features/events';
import type { Event } from '../../../../../features/events';

export default function NewEventPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();

  function handleSuccess(event: Event) {
    router.push(`/organizations/${organizationId}/events/${event.id}`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Novo evento</h1>
      <CreateEventForm
        organizationId={organizationId}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
