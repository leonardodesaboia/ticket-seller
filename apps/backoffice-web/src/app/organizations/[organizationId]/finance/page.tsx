'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BalanceSummaryCards } from '../../../../features/finance/components/BalanceSummaryCards';
import { FinancialSummaryPanel } from '../../../../features/finance/components/FinancialSummaryPanel';
import { TransactionHistoryTable } from '../../../../features/finance/components/TransactionHistoryTable';
import { PayoutHistoryTable } from '../../../../features/finance/components/PayoutHistoryTable';
import { PayoutRequestModal } from '../../../../features/finance/components/PayoutRequestModal';

export default function FinancePage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  return (
    <main className="flex flex-col gap-8 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe saldo, transações e saques da sua organização.
        </p>
      </div>

      {/* Balance Cards with 30s polling */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Saldo</h2>
          <button
            type="button"
            onClick={() => setIsPayoutModalOpen(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Solicitar Saque
          </button>
        </div>
        <BalanceSummaryCards organizationId={organizationId} />
      </section>

      {/* Financial Summary with period selector */}
      <section>
        <FinancialSummaryPanel organizationId={organizationId} />
      </section>

      {/* Transaction History */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Histórico de Transações</h2>
        <TransactionHistoryTable organizationId={organizationId} />
      </section>

      {/* Payout History */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Histórico de Saques</h2>
        <PayoutHistoryTable organizationId={organizationId} />
      </section>

      {/* Payout Modal */}
      {isPayoutModalOpen && (
        <PayoutRequestModal
          organizationId={organizationId}
          onClose={() => setIsPayoutModalOpen(false)}
        />
      )}
    </main>
  );
}
