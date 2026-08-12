export type CheckInResult =
  | 'ADMITTED'
  | 'ALREADY_CHECKED_IN'
  | 'INVALID_CREDENTIAL'
  | 'TICKET_CANCELLED'
  | 'EVENT_NOT_ACTIVE'
  | 'WRONG_EVENT'
  | 'TRANSFER_PENDING';

export type CheckInSource = 'SCANNER' | 'MANUAL';

export interface CheckInProps {
  id: string;
  organizationId: string;
  eventId: string;
  ticketId: string;
  credentialId: string;
  performedByUserId: string | null;
  result: CheckInResult;
  idempotencyKey: string | null;
  checkedInAt: Date;
  source: CheckInSource;
  notes: string | null;
}

export class CheckIn {
  readonly id: string;
  readonly organizationId: string;
  readonly eventId: string;
  readonly ticketId: string;
  readonly credentialId: string;
  readonly performedByUserId: string | null;
  readonly result: CheckInResult;
  readonly idempotencyKey: string | null;
  readonly checkedInAt: Date;
  readonly source: CheckInSource;
  readonly notes: string | null;

  constructor(props: CheckInProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.eventId = props.eventId;
    this.ticketId = props.ticketId;
    this.credentialId = props.credentialId;
    this.performedByUserId = props.performedByUserId;
    this.result = props.result;
    this.idempotencyKey = props.idempotencyKey;
    this.checkedInAt = props.checkedInAt;
    this.source = props.source;
    this.notes = props.notes;
  }
}
