export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}

export class PublicEventNotFoundError extends Error {
  constructor() {
    super('Event not found');
    this.name = 'PublicEventNotFoundError';
  }
}
