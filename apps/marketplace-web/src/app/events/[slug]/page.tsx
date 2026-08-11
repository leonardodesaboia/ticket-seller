import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventDetails } from '@/features/public-event-details';
import { TicketSelection } from '@/features/ticket-selection';
import { getPublicEvent } from '@/shared/api/public-events.api';

// Rendered per-request against the live API (cached 60s at the fetch layer).
export const dynamic = 'force-dynamic';

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reservation?: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) {
    return { title: 'Evento não encontrado' };
  }
  const canonical = `/events/${event.slug}`;
  return {
    title: event.title,
    ...(event.description && { description: event.description }),
    alternates: { canonical },
    openGraph: {
      title: event.title,
      ...(event.description && { description: event.description }),
      url: canonical,
      type: 'website',
    },
  };
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const { reservation } = await searchParams;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return (
    <>
      {reservation === 'lost' && <p role="alert" tabIndex={-1} className="mx-auto mt-8 block max-w-2xl text-destructive">Sua sessão de reserva não está mais disponível. Selecione seus ingressos novamente.</p>}
      <EventDetails event={event} />
      <div className="mx-auto max-w-2xl px-8 pb-8">
        <TicketSelection eventSlug={event.slug} currency={event.currency ?? 'BRL'} ticketTypes={event.ticketTypes} />
      </div>
    </>
  );
}
