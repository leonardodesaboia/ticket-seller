'use client';

import { useState } from 'react';
import { acceptTransfer } from '@/shared/api/transfers.api';
import { PublicApiError } from '@/shared/api/public-reservations.api';

type PageState = 'CONFIRMING' | 'ACCEPTING' | 'SUCCESS' | 'EXPIRED' | 'ALREADY_ACCEPTED' | 'ERROR';

export interface AcceptTransferPageProps {
  claimToken: string;
}

export function AcceptTransferPage({ claimToken }: AcceptTransferPageProps) {
  const [state, setState] = useState<PageState>('CONFIRMING');

  async function handleAccept() {
    setState('ACCEPTING');
    const idempotencyKey = crypto.randomUUID();
    try {
      await acceptTransfer(claimToken, idempotencyKey);
      setState('SUCCESS');
    } catch (err) {
      if (err instanceof PublicApiError) {
        if (err.status === 400 && err.code === 'TRANSFER_EXPIRED') {
          setState('EXPIRED');
          return;
        }
        if (err.status === 409 && err.code === 'TRANSFER_ALREADY_ACCEPTED') {
          setState('ALREADY_ACCEPTED');
          return;
        }
        if (err.status === 404) {
          setState('EXPIRED');
          return;
        }
      }
      setState('ERROR');
    }
  }

  if (state === 'CONFIRMING') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Ingresso recebido</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Você recebeu um ingresso. Deseja aceitar?
          </p>
          <button
            type="button"
            onClick={handleAccept}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Aceitar
          </button>
        </div>
      </main>
    );
  }

  if (state === 'ACCEPTING') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Ingresso recebido</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Você recebeu um ingresso. Deseja aceitar?
          </p>
          <button
            type="button"
            disabled
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
          >
            Processando…
          </button>
        </div>
      </main>
    );
  }

  if (state === 'SUCCESS') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-4 text-xl font-bold text-foreground">Transferência concluída!</h1>
          <p className="text-sm text-muted-foreground">
            Ingresso transferido! Você já pode gerar seu novo QR Code no app.
          </p>
        </div>
      </main>
    );
  }

  if (state === 'EXPIRED') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <p className="text-sm text-muted-foreground">Este link expirou.</p>
        </div>
      </main>
    );
  }

  if (state === 'ALREADY_ACCEPTED') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <p className="text-sm text-muted-foreground">Este ingresso já foi transferido.</p>
        </div>
      </main>
    );
  }

  // ERROR state
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
        <p role="alert" className="text-sm text-destructive">
          Ocorreu um erro. Tente novamente.
        </p>
        <button
          type="button"
          onClick={() => setState('CONFIRMING')}
          className="mt-4 rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
