'use client';

import { useEffect, useState } from 'react';
import { getOrderTickets, type TicketItem } from '@/shared/api/public-payments.api';
import { TicketList } from '@/features/tickets/TicketList';

export interface ConfirmationViewProps {
  orderId: string;
  token: string;
}

export function ConfirmationView({ orderId, token }: ConfirmationViewProps) {
  const [tickets, setTickets] = useState<TicketItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setTickets(null);
    getOrderTickets(orderId, token)
      .then((data) => {
        if (!cancelled) setTickets(data.tickets);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar seus ingressos.');
      });
    return () => { cancelled = true; };
  }, [orderId, token, retryCount]);

  return (
    <section aria-labelledby="confirmation-heading" className="flex flex-col gap-6">
      <header>
        <h2 id="confirmation-heading" className="text-2xl font-bold text-foreground">
          Pagamento confirmado!
        </h2>
        <p className="mt-1 text-muted-foreground">
          Seus ingressos foram emitidos.
        </p>
      </header>

      {error && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((n) => n + 1)}
            className="self-start text-sm underline text-primary hover:opacity-80"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {tickets === null && !error && (
        <p aria-busy="true" className="text-sm text-muted-foreground">
          Carregando ingressos…
        </p>
      )}

      {tickets !== null && <TicketList tickets={tickets} />}
    </section>
  );
}
