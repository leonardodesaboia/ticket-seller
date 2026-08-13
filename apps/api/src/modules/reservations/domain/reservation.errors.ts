export class EventNotFoundForReservationError extends Error {
  constructor() {
    super('Event not found');
  }
}

export class TicketTypeNotFoundForReservationError extends Error {
  constructor() {
    super('Ticket type not found');
  }
}

export class TicketTypeInactiveForReservationError extends Error {
  constructor() {
    super('Ticket type is inactive');
  }
}

export class EventNotPublishedForReservationError extends Error {
  constructor() {
    super('Event is not published');
  }
}

export class InvalidReservationTokenError extends Error {
  constructor() {
    super('Invalid reservation token');
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super('Reservation not found');
  }
}

export class ReservationExpiredError extends Error {
  constructor() {
    super('Reservation has expired');
  }
}

export class ReservationAlreadyConsumedError extends Error {
  constructor() {
    super('Reservation has already been consumed');
  }
}

export class ReservationIdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was reused with a different request');
  }
}

export class InsufficientInventoryForReservationError extends Error {
  constructor() {
    super('Insufficient inventory');
  }
}
