export class IdempotencyKeyConflictError extends Error {
  constructor(message = 'Idempotency key was already used with a different request') {
    super(message);
    this.name = 'IdempotencyKeyConflictError';
  }
}
