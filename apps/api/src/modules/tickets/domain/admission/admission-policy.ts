import { AdmissionContext } from './admission-context';
import { ADMISSION, AdmissionDecision } from './admission-decision';

/**
 * Status de evento que permitem check-in.
 * Apenas eventos PUBLISHED estão abertos para admissão.
 * (DRAFT = em preparação; não há outros status no domínio atual)
 */
const ACTIVE_EVENT_STATUSES = new Set(['PUBLISHED']);

export class AdmissionPolicy {
  evaluate(ctx: AdmissionContext): AdmissionDecision {
    // 1. Credencial não encontrada ou revogada
    if (!ctx.credential || ctx.credential.status !== 'ACTIVE') {
      return ADMISSION.INVALID_CREDENTIAL;
    }

    // 2. Ticket não encontrado (inconsistência de dados)
    if (!ctx.ticket) {
      return ADMISSION.INVALID_CREDENTIAL;
    }

    // 3. Ticket cancelado
    if (ctx.ticket.status === 'CANCELLED') {
      return ADMISSION.TICKET_CANCELLED;
    }

    // 4. Ticket pertence a outro evento
    if (ctx.ticket.eventId !== ctx.targetEventId) {
      return ADMISSION.WRONG_EVENT;
    }

    // 5. Evento não está ativo para check-in
    if (!ACTIVE_EVENT_STATUSES.has(ctx.eventStatus)) {
      return ADMISSION.EVENT_NOT_ACTIVE;
    }

    // 6. Transferência pendente
    if (ctx.ticket.transferPending) {
      return ADMISSION.TRANSFER_PENDING;
    }

    // 7. Já admitido
    if (ctx.alreadyAdmitted) {
      return ADMISSION.ALREADY_CHECKED_IN;
    }

    return ADMISSION.VALID;
  }
}
