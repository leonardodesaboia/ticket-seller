export class InvalidReservationTokenForOrderError extends Error {
  constructor() { super('Invalid reservation token'); }
}

export class ReservationNotFoundForOrderError extends Error {
  constructor() { super('Reservation not found'); }
}

export class ReservationExpiredForOrderError extends Error {
  constructor() { super('Reservation has expired'); }
}

export class ReservationCancelledForOrderError extends Error {
  constructor() { super('Reservation has been cancelled'); }
}

export class ReservationAlreadyConsumedForOrderError extends Error {
  constructor() { super('Reservation has already been consumed'); }
}

export class OrderAlreadyExistsError extends Error {
  constructor() { super('An order already exists for this reservation'); }
}

export class OrderIdempotencyConflictError extends Error {
  constructor() { super('Idempotency key was reused with a different request'); }
}

export class OrderNotFoundError extends Error {
  constructor() { super('Order not found'); }
}
