import { TicketTransfer } from '../ticket-transfer.entity';

export interface CreateTransferData {
  id: string;
  ticketId: string;
  organizationId: string;
  claimTokenHash: string;
  expiresAt: Date;
}

export interface AcceptAtomicParams {
  transferId: string;
  ticketId: string;
  organizationId: string;
}

export interface ITicketTransferRepository {
  findPendingByTicketId(ticketId: string, organizationId: string): Promise<TicketTransfer | null>;
  findByClaimTokenHash(hash: string): Promise<TicketTransfer | null>;
  create(data: CreateTransferData): Promise<TicketTransfer>;
  cancel(id: string): Promise<void>;
  accept(id: string): Promise<void>;
  /** Atomically accept: locks ticket, re-verifies status, revokes old credentials, issues new credential. Returns the new plaintext token. */
  acceptAtomically(params: AcceptAtomicParams): Promise<string>;
}

export const TICKET_TRANSFER_REPOSITORY = Symbol('TICKET_TRANSFER_REPOSITORY');
