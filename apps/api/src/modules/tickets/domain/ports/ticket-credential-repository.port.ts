import { TicketCredential } from '../ticket-credential.entity';

export interface CreateCredentialData {
  id: string;
  ticketId: string;
  organizationId: string;
  tokenHash: string;
  version: number;
}

export interface ITicketCredentialRepository {
  /** Returns the active credential or null. */
  findActiveByTicketId(ticketId: string, organizationId: string): Promise<TicketCredential | null>;
  /** Finds by token hash within a tenant — used for validation/check-in. */
  findByTokenHash(tokenHash: string, organizationId: string): Promise<TicketCredential | null>;
  /** INSERT ... ON CONFLICT (ticket_id) WHERE active DO NOTHING — returns new or null if conflict. */
  createIfNoneActive(data: CreateCredentialData): Promise<TicketCredential | null>;
  /** Revokes all active credentials for a ticket and creates a new one atomically. */
  rotateCredential(ticketId: string, organizationId: string, newData: CreateCredentialData): Promise<TicketCredential>;
}

export const TICKET_CREDENTIAL_REPOSITORY = Symbol('TICKET_CREDENTIAL_REPOSITORY');
