export type CredentialStatus = 'ACTIVE' | 'REVOKED';

export interface TicketCredentialProps {
  id: string;
  ticketId: string;
  organizationId: string;
  tokenHash: string;
  status: CredentialStatus;
  version: number;
  issuedAt: Date;
  revokedAt: Date | null;
}

export class TicketCredential {
  readonly id: string;
  readonly ticketId: string;
  readonly organizationId: string;
  readonly tokenHash: string;
  readonly status: CredentialStatus;
  readonly version: number;
  readonly issuedAt: Date;
  readonly revokedAt: Date | null;

  constructor(props: TicketCredentialProps) {
    if (props.tokenHash.length !== 64) throw new Error('tokenHash must be 64 hex chars');
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.organizationId = props.organizationId;
    this.tokenHash = props.tokenHash;
    this.status = props.status;
    this.version = props.version;
    this.issuedAt = props.issuedAt;
    this.revokedAt = props.revokedAt;
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }
}
