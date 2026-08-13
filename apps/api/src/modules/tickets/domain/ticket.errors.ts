export class TicketOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} not found for ticket access`);
    this.name = 'TicketOrderNotFoundError';
  }
}

export class TicketInvalidTokenError extends Error {
  constructor() {
    super('Invalid reservation token for ticket access');
    this.name = 'TicketInvalidTokenError';
  }
}
