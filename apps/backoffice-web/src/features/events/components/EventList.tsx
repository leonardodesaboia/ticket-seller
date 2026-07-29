import Link from 'next/link';
import type { Event } from '../types';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  PUBLISHED: 'bg-primary text-primary-foreground',
  PAUSED: 'text-foreground border border-input',
  CANCELLED: 'bg-destructive text-destructive-foreground',
  COMPLETED: 'bg-muted text-muted-foreground',
};

interface EventListProps {
  events: Event[];
  organizationId: string;
  nextCursor: string | null;
  isLoading: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}

export function EventList({
  events,
  organizationId,
  nextCursor,
  isLoading,
  isFetching,
  onLoadMore,
}: EventListProps) {
  if (isLoading) {
    return <p className="text-muted-foreground">Carregando eventos...</p>;
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground">Nenhum evento encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {events.map((event) => {
          const statusLabel = STATUS_LABELS[event.status] ?? event.status;
          const statusClass = STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground';
          return (
            <li
              key={event.id}
              className="flex items-center justify-between rounded-md border border-input bg-background p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{event.title}</span>
                <span className="text-xs text-muted-foreground">v{event.version}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                  {statusLabel}
                </span>
                {event.status === 'DRAFT' && (
                  <Link
                    href={`/organizations/${organizationId}/events/${event.id}/edit`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Editar
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetching}
          className="mx-auto rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
        >
          {isFetching ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
