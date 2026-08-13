export class EventNotFoundError extends Error {
  readonly code = 'EVENT_NOT_FOUND';
  constructor() { super('Event not found for this organization'); }
}
