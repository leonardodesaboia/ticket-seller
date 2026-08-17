export class EventNotFoundError extends Error {
  constructor() {
    super('Event not found');
    this.name = 'EventNotFoundError';
  }
}

export class EventNotCancellableError extends Error {
  constructor(public readonly code: string) {
    super(`Event cannot be cancelled: ${code}`);
    this.name = 'EventNotCancellableError';
  }
}
