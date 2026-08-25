'use client';

import type { AdmissionDecision } from '@/shared/api/check-in.api';

const DECISION_LABELS: Record<AdmissionDecision, string> = {
  ADMITTED: 'Admitido',
  ALREADY_CHECKED_IN: 'Já realizado check-in',
  INVALID_CREDENTIAL: 'QR inválido',
  TICKET_CANCELLED: 'Ingresso cancelado',
  EVENT_NOT_ACTIVE: 'Evento não está ativo',
  WRONG_EVENT: 'Ingresso de outro evento',
  TRANSFER_PENDING: 'Transferência pendente',
};

interface DecisionFeedbackProps {
  decision: AdmissionDecision | null;
  allowed: boolean;
}

export function DecisionFeedback({ decision, allowed }: DecisionFeedbackProps) {
  if (decision === null) {
    return null;
  }

  const label = DECISION_LABELS[decision] ?? decision;
  const isAdmitted = allowed && decision === 'ADMITTED';

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-lg p-4 text-lg font-semibold ${
        isAdmitted
          ? 'bg-primary/10 text-primary'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      <span aria-hidden="true" className="text-2xl">
        {isAdmitted ? '✓' : '✗'}
      </span>
      <span>{label}</span>
    </div>
  );
}
