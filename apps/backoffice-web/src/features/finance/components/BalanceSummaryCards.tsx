'use client';

import { useBalance } from '../hooks/useBalance';
import { formatCurrency } from '../lib/currency';

interface BalanceSummaryCardsProps {
  organizationId: string;
  devUserId: string;
}

interface CardProps {
  label: string;
  value: string;
  currency: string;
  description?: string;
}

function Card({ label, value, currency, description }: CardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-input bg-background p-4">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-bold text-foreground">
        {formatCurrency(value, currency)}
      </span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

export function BalanceSummaryCards({ organizationId, devUserId }: BalanceSummaryCardsProps) {
  const { data: balance, isLoading, error } = useBalance(organizationId, devUserId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['Pendente', 'Disponível', 'Reservado'] as const).map((label) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-md border border-input bg-background p-4 animate-pulse"
          >
            <span className="h-3 w-20 rounded bg-muted" />
            <span className="h-7 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !balance) {
    return (
      <p className="text-sm text-destructive">Erro ao carregar saldo.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card
        label="Pendente"
        value={balance.pendingAmount}
        currency={balance.currency}
        description="Aguardando liquidação"
      />
      <Card
        label="Disponível"
        value={balance.availableAmount}
        currency={balance.currency}
        description="Pronto para saque"
      />
      <Card
        label="Reservado"
        value={balance.reservedAmount}
        currency={balance.currency}
        description="Em processamento de saque"
      />
    </div>
  );
}
