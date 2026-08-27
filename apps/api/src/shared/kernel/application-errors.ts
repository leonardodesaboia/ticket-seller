export class ApplicationError extends Error {
  readonly statusHint: number;
  constructor(message: string, statusHint: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusHint = statusHint;
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class UnprocessableError extends ApplicationError {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message, 422);
    if (code !== undefined) this.code = code;
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string) {
    super(message, 429);
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor(message: string) {
    super(message, 503);
  }
}
