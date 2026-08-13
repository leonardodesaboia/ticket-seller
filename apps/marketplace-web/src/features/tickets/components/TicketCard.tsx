'use client';

import { useState } from 'react';
import type { TicketItem } from '@/shared/api/public-payments.api';
import { InitiateTransferModal } from '@/features/transfer/components/InitiateTransferModal';

export interface TicketCardProps {
  ticket: TicketItem;
  orderId: string;
  token: string;
}

export function TicketCard({ ticket, orderId, token }: TicketCardProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <li
      className="rounded-md border border-input p-4"
      aria-label={`Código do ingresso ${ticket.unitIndex + 1}: ${ticket.publicCode}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-medium text-foreground">
            {ticket.publicCode}
          </span>
          <span className="text-xs text-muted-foreground">
            Ingresso {ticket.unitIndex + 1} — {ticket.status}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Transferir
        </button>
      </div>

      {showModal && (
        <InitiateTransferModal
          ticket={ticket}
          orderId={orderId}
          token={token}
          onClose={() => setShowModal(false)}
        />
      )}
    </li>
  );
}
