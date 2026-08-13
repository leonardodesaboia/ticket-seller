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
}

export const TICKET_TRANSFER_REPOSITORY = Symbol('TICKET_TRANSFER_REPOSITORY');
