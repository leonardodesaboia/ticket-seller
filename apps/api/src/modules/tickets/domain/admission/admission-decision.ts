export type AdmissionCode =
  | 'VALID'
  | 'INVALID_CREDENTIAL'
  | 'TICKET_CANCELLED'
  | 'ALREADY_CHECKED_IN'
  | 'EVENT_NOT_ACTIVE'
  | 'WRONG_EVENT'
  | 'TRANSFER_PENDING';

export interface AdmissionDecision {
  code: AdmissionCode;
  allowed: boolean;
}

export const ADMISSION: Record<AdmissionCode, AdmissionDecision> = {
  VALID:              { code: 'VALID', allowed: true },
  INVALID_CREDENTIAL: { code: 'INVALID_CREDENTIAL', allowed: false },
  TICKET_CANCELLED:   { code: 'TICKET_CANCELLED', allowed: false },
  ALREADY_CHECKED_IN: { code: 'ALREADY_CHECKED_IN', allowed: false },
  EVENT_NOT_ACTIVE:   { code: 'EVENT_NOT_ACTIVE', allowed: false },
  WRONG_EVENT:        { code: 'WRONG_EVENT', allowed: false },
  TRANSFER_PENDING:   { code: 'TRANSFER_PENDING', allowed: false },
};
