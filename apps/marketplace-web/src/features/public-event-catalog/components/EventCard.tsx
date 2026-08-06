import Link from 'next/link';
import type { PublicEventListItem } from '@/shared/api/public-events.api';
import { formatDateTime, formatEventFormat } from '@/shared/lib/event-format';

interface EventCardProps {
  event: PublicEventListItem;
}

export function EventCard({ event }: EventCardProps) {
  const formatLabel = formatEventFormat(event.format);
  const startsAt = formatDateTime(event.startsAt, event.timezone);

  return (
    <li className="list-none">
      <Link
        href={`/events/${event.slug}`}
        className="flex h-full flex-col gap-2 rounded-lg border border-input bg-background p-5 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <h2 className="text-lg font-semibold text-foreground">{event.title}</h2>
        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          {formatLabel && (
            <div className="flex gap-2">
              <dt className="sr-only">Formato</dt>
              <dd>{formatLabel}</dd>
            </div>
          )}
          {startsAt && (
            <div className="flex gap-2">
              <dt className="sr-only">Início</dt>
              <dd>
                <time dateTime={event.startsAt ?? undefined}>{startsAt}</time>
              </dd>
            </div>
          )}
        </dl>
      </Link>
    </li>
  );
}
