'use client';

import { useEffect, useState } from 'react';
import type { TicketItem } from '@/shared/api/public-payments.api';
import { initiateTransfer } from '@/shared/api/transfers.api';
import { CancelTransferButton } from './CancelTransferButton';

type ModalState = 'CONFIRMING' | 'LOADING' | 'SUCCESS' | 'ERROR';

export interface InitiateTransferModalProps {
  ticket: TicketItem;
  orderId: string;
  token: string;
  onClose: () => void;
}

export function InitiateTransferModal({
  ticket,
  orderId,
  token,
  onClose,
}: InitiateTransferModalProps) {
  const [state, setState] = useState<ModalState>('CONFIRMING');
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && state !== 'LOADING') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, onClose]);

  async function handleConfirm() {
    setState('LOADING');
    setError(null);
    try {
      const result = await initiateTransfer(orderId, ticket.ticketId, token);
      setClaimToken(result.claimToken);
      setState('SUCCESS');
    } catch {
      setError('Não foi possível iniciar a transferência. Tente novamente.');
      setState('ERROR');
    }
  }

  function buildClaimLink(token: string): string {
    return `${window.location.origin}/transfer/accept/${token}`;
  }

  async function handleCopy() {
    if (!claimToken) return;
    await navigator.clipboard.writeText(buildClaimLink(claimToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCancelled() {
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-input bg-background p-6 shadow-lg">
        <h2 id="transfer-modal-title" className="mb-4 text-lg font-semibold text-foreground">
          Transferir ingresso
        </h2>

        {(state === 'CONFIRMING' || state === 'LOADING') && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Ao aceitar a transferência, seu QR Code atual será invalidado. Um novo QR Code será
              gerado para o destinatário.
            </p>
            <p className="text-sm font-medium text-foreground">
              Ingresso: <span className="font-mono">{ticket.publicCode}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={state === 'LOADING'}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {state === 'LOADING' ? 'Gerando link…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={state === 'LOADING'}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {state === 'SUCCESS' && claimToken && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Link de transferência gerado. Compartilhe com o destinatário:
            </p>
            <div className="rounded-md border border-input bg-muted p-3">
              <p className="break-all font-mono text-xs text-foreground">
                {buildClaimLink(claimToken)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground"
              >
                Fechar
              </button>
            </div>
            <CancelTransferButton
              orderId={orderId}
              ticketId={ticket.ticketId}
              token={token}
              onCancelled={handleCancelled}
            />
          </div>
        )}

        {state === 'ERROR' && (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setState('CONFIRMING')}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
