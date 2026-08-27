export class PublicEventNotFoundError extends Error {
  constructor() {
    super('Event not found');
    this.name = 'PublicEventNotFoundError';
  }
}
