import { CancellationEligibilityCode } from './cancellation-policy';

export class OrderNotFoundForCancellationError extends Error {
  readonly code = 'ORDER_NOT_FOUND' as const;
  constructor() { super('Order not found'); Object.setPrototypeOf(this, new.target.prototype); }
}

export class InvalidReservationTokenError extends Error {
  readonly code = 'INVALID_RESERVATION_TOKEN' as const;
  constructor() { super('Invalid reservation token'); Object.setPrototypeOf(this, new.target.prototype); }
}

export class OrderNotCancellableError extends Error {
  readonly code = 'ORDER_NOT_CANCELLABLE' as const;
  constructor(readonly eligibilityCode: CancellationEligibilityCode) {
    super(`Order cannot be cancelled: ${eligibilityCode}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientRoleForCancellationError extends Error {
  readonly code = 'INSUFFICIENT_ROLE' as const;
  constructor() { super('Insufficient role for this cancellation'); Object.setPrototypeOf(this, new.target.prototype); }
}
