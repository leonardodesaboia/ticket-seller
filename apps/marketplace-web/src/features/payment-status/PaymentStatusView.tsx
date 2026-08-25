'use client';

import { useCallback, useState, useRef } from 'react';
import { formatCurrency } from '@/shared/lib/money';
import { Button } from '@/shared/ui/primitives/button';
import type { AttemptStatus, PaymentAttemptResponse } from '@/shared/api/public-payments.api';
import { usePaymentPolling } from './hooks/usePaymentPolling';

export interface PaymentStatusViewProps {
  attempt: PaymentAttemptResponse;
  onNewAttempt: () => void;
  onConfirmed: () => void;
  onTimeout: () => void;
  token: string;
}

const STATUS_MESSAGES: Partial<Record<AttemptStatus, string>> = {
  DECLINED: 'Pagamento recusado.',
  CANCELLED: 'Pagamento cancelado.',
  EXPIRED: 'O tempo para pagamento expirou.',
};

const FAILED_STATUSES: AttemptStatus[] = ['DECLINED', 'CANCELLED', 'EXPIRED'];

export function PaymentStatusView({ attempt: initialAttempt, onNewAttempt, onConfirmed, onTimeout, token }: PaymentStatusViewProps) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyPix = useCallback((code: string) => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleUpdate = useCallback((updated: PaymentAttemptResponse) => {
    setAttempt(updated);
    if (updated.status === 'APPROVED') {
      onConfirmed();
    }
  }, [onConfirmed]);

  usePaymentPolling({
    orderId: attempt.orderId,
    token,
    onUpdate: handleUpdate,
    onTimeout,
  });

  const isPix = attempt.paymentMethod === 'FAKE_PIX';
  const isFailed = FAILED_STATUSES.includes(attempt.status);
  const failureMessage = STATUS_MESSAGES[attempt.status];

  return (
    <section aria-labelledby="payment-status-heading" className="flex flex-col gap-6">
      <h2 id="payment-status-heading" className="text-xl font-semibold text-foreground">
        {isPix ? 'Pague com PIX' : 'Processando pagamento com cartão'}
      </h2>

      <div aria-live="polite">
        {isPix && attempt.checkoutData?.qrCodeText && !isFailed && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(attempt.amount, attempt.currency)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Copia e cola o código abaixo no seu app do banco:
              </p>
              <div className="rounded-md border border-input bg-muted p-3">
                <code
                  className="break-all font-mono text-sm text-foreground"
                  aria-label="Código PIX copia e cola"
                >
                  {attempt.checkoutData.qrCodeText}
                </code>
              </div>
              <button
                type="button"
                onClick={() => handleCopyPix(attempt.checkoutData!.qrCodeText!)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? 'Copiado!' : 'Copiar código PIX'}
              </button>
            </div>

            <time
              dateTime={attempt.expiresAt}
              suppressHydrationWarning
              className="text-xs text-muted-foreground"
            >
              Expira em: {new Date(attempt.expiresAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </time>

            <p className="text-sm text-muted-foreground">
              Aguardando confirmação do pagamento…
            </p>
          </div>
        )}

        {!isPix && !isFailed && (
          <p className="text-sm text-muted-foreground">
            Processando pagamento com cartão…
          </p>
        )}

        {isFailed && failureMessage && (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive">
              {failureMessage}
            </p>
            <Button onClick={onNewAttempt} variant="outline">
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
