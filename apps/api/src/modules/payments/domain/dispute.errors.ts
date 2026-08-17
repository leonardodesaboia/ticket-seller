export class PaymentAttemptNotFoundForDisputeError extends Error {
  constructor(externalPaymentId: string) {
    super(`Payment attempt not found for externalPaymentId: ${externalPaymentId}`);
    this.name = 'PaymentAttemptNotFoundForDisputeError';
  }
}
