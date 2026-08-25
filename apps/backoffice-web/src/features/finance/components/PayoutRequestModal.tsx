'use client';

import { useEffect, useState } from 'react';
import { useCreatePayout } from '../hooks/useCreatePayout';

interface PayoutRequestModalProps {
  organizationId: string;
  devUserId: string;
  onClose: () => void;
}

export function PayoutRequestModal({ organizationId, devUserId, onClose }: PayoutRequestModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreatePayout(organizationId, devUserId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !mutation.isPending) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mutation.isPending, onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const normalised = amountInput.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalised)) {
      setError('Informe um valor válido com no máximo 2 casas decimais (ex: 100,00).');
      return;
    }
    const parsed = parseFloat(normalised);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }
    if (parsed > 1_000_000) {
      setError('Valor máximo por saque: R$ 1.000.000,00.');
      return;
    }

    // Convert BRL major units (R$) to minor units (centavos)
    const amountInMinorUnits = Math.round(parsed * 100);
    if (amountInMinorUnits < 1) {
      setError('Valor mínimo: R$ 0,01.');
      return;
    }
    const idempotencyKey = crypto.randomUUID();

    mutation.mutate(
      { amount: amountInMinorUnits, currency: 'BRL', idempotencyKey },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err) => {
          setError(err.message ?? 'Erro ao solicitar saque.');
        },
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-md rounded-lg border border-input bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 id="payout-modal-title" className="text-lg font-semibold text-foreground">Solicitar Saque</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="payout-amount"
              className="text-sm font-medium text-foreground"
            >
              Valor (R$)
            </label>
            <input
              id="payout-amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0,00"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            <span className="text-xs text-muted-foreground">
              Informe o valor em reais (ex: 100,00)
            </span>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {mutation.isSuccess && (
            <p className="text-sm text-primary">Saque solicitado com sucesso!</p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Aguarde...' : 'Confirmar saque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
