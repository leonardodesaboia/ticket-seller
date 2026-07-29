export class TicketTypeNotFoundError extends Error {
  constructor() {
    super('Ticket type not found');
    this.name = 'TicketTypeNotFoundError';
  }
}

export class TicketTypeNotBelongToEventError extends Error {
  constructor() {
    super('Ticket type does not belong to this event');
    this.name = 'TicketTypeNotBelongToEventError';
  }
}

export class EventCurrencyNotSetError extends Error {
  constructor() {
    super('Event currency must be set before creating ticket types');
    this.name = 'EventCurrencyNotSetError';
  }
}

export class EventCurrencyLockedError extends Error {
  constructor() {
    super('Currency cannot be changed after ticket types have been created');
    this.name = 'EventCurrencyLockedError';
  }
}

export class TicketTypeVersionConflictError extends Error {
  constructor() {
    super('Ticket type was modified by another request; please refresh and try again');
    this.name = 'TicketTypeVersionConflictError';
  }
}
