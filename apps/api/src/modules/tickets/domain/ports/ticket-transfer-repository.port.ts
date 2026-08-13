import { Prisma } from '@prisma/client';
import { TicketTransfer } from '../ticket-transfer.entity';

export interface CreateTransferData {
  id: string;
  ticketId: string;
  organizationId: string;
  claimTokenHash: string;
  expiresAt: Date;
}

export type PrismaTransactionClient = Prisma.TransactionClient;

export interface AcceptAtomicParams {
  transferId: string;
  ticketId: string;
  organizationId: string;
}

export interface ITicketTransferRepository {
  /** Find a PENDING transfer for a given ticket and organization. */
  findPendingByTicketId(ticketId: string, organizationId: string): Promise<TicketTransfer | null>;
  /** Find a transfer by its claim token hash (any status). */
  findByClaimTokenHash(hash: string): Promise<TicketTransfer | null>;
  /** Create a new transfer record. */
  create(data: CreateTransferData): Promise<TicketTransfer>;
  /** Cancel a pending transfer (set status to CANCELLED). */
  cancel(id: string): Promise<void>;
  /** Accept a transfer inside an optional transaction client. */
  accept(id: string, tx?: PrismaTransactionClient): Promise<void>;
  /** Atomically accept a transfer: locks ticket, verifies status, revokes old credentials, issues new credential. Returns the new plaintext credential token. */
  acceptAtomically(params: AcceptAtomicParams): Promise<string>;
}

export const TICKET_TRANSFER_REPOSITORY = Symbol('TICKET_TRANSFER_REPOSITORY');
