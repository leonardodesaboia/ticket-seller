'use client';

import { Button } from '@/shared/ui/primitives/button';
import type { PaymentMethod } from '@/shared/api/public-payments.api';

export interface SelectMethodViewProps {
  onSelect: (method: PaymentMethod) => void;
  isCreating: boolean;
  error?: string;
}

export function SelectMethodView({ onSelect, isCreating, error }: SelectMethodViewProps) {
  return (
    <section aria-labelledby="select-method-heading" className="flex flex-col gap-4">
      <h2 id="select-method-heading" className="text-xl font-semibold text-foreground">
        Escolha a forma de pagamento
      </h2>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button
          onClick={() => { onSelect('FAKE_PIX'); }}
          disabled={isCreating}
          aria-busy={isCreating}
          className="w-full"
        >
          Pagar com PIX
        </Button>

        <Button
          onClick={() => { onSelect('FAKE_CREDIT_CARD'); }}
          disabled={isCreating}
          aria-busy={isCreating}
          variant="outline"
          className="w-full"
        >
          Pagar com Cartão
        </Button>
      </div>

      {isCreating && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Criando pagamento…
        </p>
      )}
    </section>
  );
}
