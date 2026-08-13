export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED';

export interface TicketTransferProps {
  id: string;
  ticketId: string;
  organizationId: string;
  claimTokenHash: string;
  status: TransferStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export class TicketTransfer {
  readonly id: string;
  readonly ticketId: string;
  readonly organizationId: string;
  readonly claimTokenHash: string;
  readonly status: TransferStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;

  constructor(props: TicketTransferProps) {
    if (props.claimTokenHash.length !== 64) {
      throw new Error('claimTokenHash must be exactly 64 characters (SHA-256 hex)');
    }
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.organizationId = props.organizationId;
    this.claimTokenHash = props.claimTokenHash;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.acceptedAt = props.acceptedAt;
    this.cancelledAt = props.cancelledAt;
    this.createdAt = props.createdAt;
  }

  isPending(): boolean {
    return this.status === 'PENDING';
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}
