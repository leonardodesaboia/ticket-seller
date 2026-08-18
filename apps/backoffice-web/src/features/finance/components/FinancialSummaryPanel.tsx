'use client';

import { useState } from 'react';
import { useFinanceSummary } from '../hooks/useFinanceSummary';
import { formatCurrency } from '../lib/currency';

type Period = 7 | 30 | 90;

interface FinancialSummaryPanelProps {
  organizationId: string;
  devUserId: string;
}

function periodDates(days: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

const PERIOD_LABELS: Record<Period, string> = {
  7: '7 dias',
  30: '30 dias',
  90: '90 dias',
};

export function FinancialSummaryPanel({ organizationId, devUserId }: FinancialSummaryPanelProps) {
  const [period, setPeriod] = useState<Period>(30);
  const { from, to } = periodDates(period);

  const { data: summary, isLoading, error } = useFinanceSummary(organizationId, from, to, devUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Resumo Financeiro</h2>
        <div className="flex gap-2">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input bg-background text-foreground hover:bg-accent'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">Erro ao carregar resumo financeiro.</p>
      )}

      {summary && !isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryItem label="Vendas brutas" value={summary.grossSales} currency={summary.currency} />
          <SummaryItem label="Taxas da plataforma" value={summary.platformFees} currency={summary.currency} />
          <SummaryItem label="Reembolsos" value={summary.refunds} currency={summary.currency} />
          <SummaryItem label="Vendas líquidas" value={summary.netSales} currency={summary.currency} highlight />
        </div>
      )}
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  currency: string;
  highlight?: boolean;
}

function SummaryItem({ label, value, currency, highlight }: SummaryItemProps) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border p-3 ${
        highlight ? 'border-primary bg-primary/5' : 'border-input bg-background'
      }`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {formatCurrency(value, currency)}
      </span>
    </div>
  );
}
