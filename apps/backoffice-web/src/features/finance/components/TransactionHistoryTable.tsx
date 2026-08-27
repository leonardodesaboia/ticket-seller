'use client';

import { useTransactions } from '../hooks/useTransactions';
import { formatCurrency } from '../lib/currency';

interface TransactionHistoryTableProps {
  organizationId: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  SALE_RECORDED: 'Venda',
  REFUND_RECORDED: 'Reembolso',
  CHARGEBACK_RECORDED: 'Chargeback',
  PAYOUT_REQUESTED: 'Saque solicitado',
  PAYOUT_SUCCEEDED: 'Saque concluído',
  PAYOUT_FAILED: 'Saque falhou',
};

export function TransactionHistoryTable({ organizationId }: TransactionHistoryTableProps) {
  const { transactions, nextCursor, isLoading, isFetching, error, loadMore } =
    useTransactions(organizationId);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando transações...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">Erro ao carregar transações.</p>;
  }

  if (transactions.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border border-input">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Movimento</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={`${tx.id}-${tx.entryType}`}
                className="border-b border-input last:border-0 hover:bg-accent/50"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {SOURCE_TYPE_LABELS[tx.sourceType] ?? tx.sourceType}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tx.description ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(tx.occurredAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(tx.amount, tx.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tx.entryType === 'CREDIT'
                        ? 'bg-success-muted text-success'
                        : 'bg-destructive-muted text-destructive'
                    }`}
                  >
                    {tx.entryType === 'CREDIT' ? 'Crédito' : 'Débito'}
                  </span>
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
