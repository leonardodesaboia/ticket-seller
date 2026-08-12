import type { TicketItem } from '@/shared/api/public-payments.api';

export interface TicketListProps {
  tickets: TicketItem[];
}

export function TicketList({ tickets }: TicketListProps) {
  if (tickets.length === 0) {
    return <p className="text-muted-foreground">Nenhum ingresso encontrado.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li
          key={ticket.ticketId}
          className="rounded-md border border-input p-4"
          aria-label={`Código do ingresso ${ticket.unitIndex + 1}: ${ticket.publicCode}`}
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm font-medium text-foreground">
              {ticket.publicCode}
            </span>
            <span className="text-xs text-muted-foreground">
              Ingresso {ticket.unitIndex + 1} — {ticket.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
