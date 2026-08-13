export class PaymentAttemptNotFoundError extends Error {
  constructor(orderId: string) {
    super(`No payment attempt found for order ${orderId}`);
    this.name = 'PaymentAttemptNotFoundError';
  }
}

export class PaymentAlreadyActiveError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} already has an active payment attempt`);
    this.name = 'PaymentAlreadyActiveError';
  }
}

export class OrderNotPendingPaymentError extends Error {
  constructor(orderId: string, status: string) {
    super(`Order ${orderId} is not in PENDING_PAYMENT status (current: ${status})`);
    this.name = 'OrderNotPendingPaymentError';
  }
}

export class OrderExpiredForPaymentError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} has expired`);
    this.name = 'OrderExpiredForPaymentError';
  }
}

export class OrderNotFoundForPaymentError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
    this.name = 'OrderNotFoundForPaymentError';
  }
}

export class InvalidReservationTokenForPaymentError extends Error {
  constructor() {
    super('Invalid reservation token');
    this.name = 'InvalidReservationTokenForPaymentError';
  }
}

export class UnsupportedPaymentMethodError extends Error {
  constructor(method: string) {
    super(`Payment method '${method}' is not supported`);
    this.name = 'UnsupportedPaymentMethodError';
  }
}

export class PaymentIdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency conflict: same key with different payload');
    this.name = 'PaymentIdempotencyConflictError';
  }
}
