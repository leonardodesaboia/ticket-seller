export class CredentialNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`No active credential for ticket ${ticketId}`);
    this.name = 'CredentialNotFoundError';
  }
}

export class TicketCancelledError extends Error {
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} is cancelled`);
    this.name = 'TicketCancelledError';
  }
}
