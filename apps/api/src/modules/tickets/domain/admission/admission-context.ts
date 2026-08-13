export interface AdmissionContext {
  /** SHA-256 do token apresentado no QR */
  tokenHash: string;
  /** ID do evento no qual o operador está realizando check-in */
  targetEventId: string;
  /** Credencial encontrada no banco (ou null se não existe) */
  credential: {
    status: 'ACTIVE' | 'REVOKED';
    ticketId: string;
  } | null;
  /** Ticket referenciado pela credencial (ou null se credencial não encontrada) */
  ticket: {
    status: 'ACTIVE' | 'CANCELLED';
    eventId: string;
    transferPending: boolean;
  } | null;
  /** Status do evento alvo */
  eventStatus: string; // valores reais vindos do domínio de events
  /** Já existe um ADMITTED check-in para este ticket? */
  alreadyAdmitted: boolean;
}
