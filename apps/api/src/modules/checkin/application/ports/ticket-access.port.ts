export const TICKET_ACCESS_FOR_CHECKIN_PORT = Symbol('TICKET_ACCESS_FOR_CHECKIN_PORT');

export interface TicketDataForCheckIn {
  ticketId: string;
  ticketEventId: string;
  ticketStatus: 'ACTIVE' | 'CANCELLED';
  credentialId: string;
  credentialStatus: 'ACTIVE' | 'REVOKED';
  transferPending: boolean;
}

export interface ITicketAccessForCheckInPort {
  /**
   * Find ticket and credential data by credential token hash and organizationId.
   * Returns null if no credential matches the hash within the organization.
   */
  findTicketByCredentialHash(
    tokenHash: string,
    organizationId: string,
  ): Promise<TicketDataForCheckIn | null>;
}
