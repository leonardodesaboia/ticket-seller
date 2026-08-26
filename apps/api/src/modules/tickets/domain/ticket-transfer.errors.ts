export class TransferAlreadyPendingError extends Error {
  readonly code = 'TRANSFER_ALREADY_PENDING';
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} already has a pending transfer`);
    this.name = 'TransferAlreadyPendingError';
  }
}

export class TransferExpiredError extends Error {
  readonly code = 'TRANSFER_EXPIRED';
  constructor() {
    super('Transfer link has expired');
    this.name = 'TransferExpiredError';
  }
}

export class TransferAlreadyAcceptedError extends Error {
  readonly code = 'TRANSFER_ALREADY_ACCEPTED';
  constructor() {
    super('Transfer has already been accepted');
    this.name = 'TransferAlreadyAcceptedError';
  }
}

export class TicketAlreadyAdmittedError extends Error {
  readonly code = 'TICKET_ALREADY_ADMITTED';
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} has already been admitted and cannot be transferred`);
    this.name = 'TicketAlreadyAdmittedError';
  }
}

export class TransferNotFoundError extends Error {
  readonly code = 'TRANSFER_NOT_FOUND';
  constructor() {
    super('Transfer not found');
    this.name = 'TransferNotFoundError';
  }
}

export class TicketCancelledForTransferError extends Error {
  readonly code = 'TICKET_CANCELLED';
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} is cancelled and cannot be transferred`);
    this.name = 'TicketCancelledForTransferError';
  }
}
