import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventDetails } from '@/features/public-event-details';
import { getPublicEvent } from '@/shared/api/public-events.api';

// Rendered per-request against the live API (cached 60s at the fetch layer).
export const dynamic = 'force-dynamic';

interface EventPageProps {
  params: Promise<{ slug: string }>;
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

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <EventDetails event={event} />;
}
