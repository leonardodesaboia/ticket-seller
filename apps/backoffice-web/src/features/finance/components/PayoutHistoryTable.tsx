'use client';

import { usePayouts } from '../hooks/usePayouts';
import { formatCurrency } from '../lib/currency';
import type { PayoutStatus } from '../types';

interface PayoutHistoryTableProps {
  organizationId: string;
  devUserId: string;
}

const STATUS_LABELS: Record<PayoutStatus, string> = {
  SCHEDULED: 'Agendado',
  HELD: 'Em espera',
  PROCESSING: 'Em processamento',
  PAID: 'Pago',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  REVERSED: 'Revertido',
};

const STATUS_CLASSES: Record<PayoutStatus, string> = {
  SCHEDULED: 'bg-secondary text-secondary-foreground',
  HELD: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-destructive text-destructive-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
  REVERSED: 'bg-orange-100 text-orange-700',
};

export function PayoutHistoryTable({ organizationId, devUserId }: PayoutHistoryTableProps) {
  const { payouts, nextCursor, isLoading, isFetching, error, loadMore } = usePayouts(
    organizationId,
    devUserId,
  );

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando saques...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">Erro ao carregar saques.</p>;
  }

  if (payouts.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum saque encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border border-input">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3">Solicitado em</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provedor</th>
              <th className="px-4 py-3">ID externo</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr
                key={payout.id}
                className="border-b border-input last:border-0 hover:bg-accent/50"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(payout.requestedAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatCurrency(payout.amount, payout.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASSES[payout.status]
                    }`}
                  >
                    {STATUS_LABELS[payout.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{payout.provider}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {payout.externalPayoutId ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isFetching}
          className="mx-auto rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
        >
          {isFetching ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
