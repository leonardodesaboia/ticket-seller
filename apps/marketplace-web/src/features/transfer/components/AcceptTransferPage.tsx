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
  const [credentialToken, setCredentialToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAccept() {
    setState('ACCEPTING');
    const idempotencyKey = crypto.randomUUID();
    try {
      const result = await acceptTransfer(claimToken, idempotencyKey);
      setCredentialToken(result.newCredentialToken);
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

  async function handleCopy() {
    if (!credentialToken) return;
    await navigator.clipboard.writeText(credentialToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state === 'CONFIRMING' || state === 'ACCEPTING') {
    const isAccepting = state === 'ACCEPTING';
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Ingresso recebido</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {isAccepting ? 'Processando a transferência…' : 'Você recebeu um ingresso. Deseja aceitar?'}
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isAccepting}
            aria-busy={isAccepting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isAccepting ? 'Processando…' : 'Aceitar'}
          </button>
        </div>
      </main>
    );
  }

  if (state === 'SUCCESS') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Transferência concluída!</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Ingresso transferido com sucesso. Guarde o código abaixo — ele é necessário para gerar
            seu QR Code de entrada.
          </p>

          {credentialToken && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Código do ingresso
              </label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted p-3">
                <span className="flex-1 break-all font-mono text-xs text-foreground select-all">
                  {credentialToken}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copiar código do ingresso"
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Salve este código em local seguro. Você precisará dele para acessar o evento.
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (state === 'EXPIRED') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Link expirado</h1>
          <p className="text-sm text-muted-foreground">Este link de transferência expirou.</p>
        </div>
      </main>
    );
  }

  if (state === 'ALREADY_ACCEPTED') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-foreground">Ingresso já transferido</h1>
          <p className="text-sm text-muted-foreground">Este ingresso já foi transferido para outro destinatário.</p>
        </div>
      </main>
    );
  }

  // ERROR state
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-input bg-background p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-foreground">Erro ao transferir</h1>
        <p role="alert" className="mb-4 text-sm text-destructive">
          Ocorreu um erro. Tente novamente.
        </p>
        <button
          type="button"
          onClick={() => setState('CONFIRMING')}
          className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
