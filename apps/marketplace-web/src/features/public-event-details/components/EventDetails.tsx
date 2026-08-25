import type { PublicEventDetail } from '@/shared/api/public-events.api';
import { formatDateTime, formatEventFormat } from '@/shared/lib/event-format';
import { formatCurrency } from '@/shared/lib/money';

interface EventDetailsProps {
  event: PublicEventDetail;
}

export function EventDetails({ event }: EventDetailsProps) {
  const formatLabel = formatEventFormat(event.format);
  const startsAt = formatDateTime(event.startsAt, event.timezone);
  const endsAt = formatDateTime(event.endsAt, event.timezone);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">{event.title}</h1>
        {formatLabel && <p className="text-sm font-medium text-muted-foreground">{formatLabel}</p>}
      </header>

      {event.description && (
        <p className="whitespace-pre-wrap text-foreground">{event.description}</p>
      )}

      <section aria-labelledby="schedule-heading" className="flex flex-col gap-1">
        <h2 id="schedule-heading" className="text-lg font-semibold text-foreground">
          Quando
        </h2>
        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          {startsAt && (
            <div className="flex gap-2">
              <dt className="font-medium">Início:</dt>
              <dd>
                <time dateTime={event.startsAt ?? undefined}>{startsAt}</time>
              </dd>
            </div>
          )}
          {endsAt && (
            <div className="flex gap-2">
              <dt className="font-medium">Término:</dt>
              <dd>
                <time dateTime={event.endsAt ?? undefined}>{endsAt}</time>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {event.venue && (
        <section aria-labelledby="venue-heading" className="flex flex-col gap-1">
          <h2 id="venue-heading" className="text-lg font-semibold text-foreground">
            Onde
          </h2>
          <p className="text-sm text-muted-foreground">
            {event.venue.name} — {event.venue.city}, {event.venue.state}, {event.venue.country}
          </p>
        </section>
      )}

      <section aria-labelledby="tickets-heading" className="flex flex-col gap-2">
        <h2 id="tickets-heading" className="text-lg font-semibold text-foreground">
          Ingressos
        </h2>
        {event.ticketTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ingresso disponível.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {event.ticketTypes.map((ticketType) => (
              <li
                key={ticketType.ticketTypeId}
                className="flex items-start justify-between gap-4 rounded-md border border-input p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{ticketType.name}</span>
                  {ticketType.description && (
                    <span className="text-sm text-muted-foreground">{ticketType.description}</span>
                  )}
                </div>
                <span className="whitespace-nowrap font-semibold text-foreground">
                  {formatCurrency(ticketType.price, ticketType.currency ?? 'BRL')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
