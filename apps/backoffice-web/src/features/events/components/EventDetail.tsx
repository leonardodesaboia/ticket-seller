import type { Event } from '../types';

interface EventDetailProps {
  event: Event;
}

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

export function EventDetail({ event }: EventDetailProps) {
  const statusLabel = STATUS_LABELS[event.status] ?? event.status;
  const statusClass = STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground';

  return (
    <article className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {event.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
      )}

      <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt className="font-medium">Criado em:</dt>
          <dd>
            <time dateTime={event.createdAt} suppressHydrationWarning>
              {new Date(event.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </time>
          </dd>
        </div>
        {event.updatedAt && (
          <div className="flex gap-2">
            <dt className="font-medium">Atualizado em:</dt>
            <dd>
              <time dateTime={event.updatedAt} suppressHydrationWarning>
                {new Date(event.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </time>
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
