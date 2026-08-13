'use client';

import { useState } from 'react';
import { cancelTransfer } from '@/shared/api/transfers.api';

export interface CancelTransferButtonProps {
  orderId: string;
  ticketId: string;
  token: string;
  onCancelled: () => void;
}

export function CancelTransferButton({ orderId, ticketId, token, onCancelled }: CancelTransferButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      await cancelTransfer(orderId, ticketId, token);
      onCancelled();
    } catch {
      setError('Não foi possível cancelar a transferência. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="text-sm text-destructive underline disabled:opacity-50"
      >
        {loading ? 'Cancelando…' : 'Cancelar transferência'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
