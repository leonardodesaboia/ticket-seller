export class EventNotFoundError extends Error {
  constructor() {
    super('Event not found');
    this.name = 'EventNotFoundError';
  }
}

export class OrganizationAccessDeniedError extends Error {
  constructor() {
    super('Organization not found or access denied');
    this.name = 'OrganizationAccessDeniedError';
  }
}

export class InsufficientRoleError extends Error {
  constructor() {
    super('Insufficient role to perform this action');
    this.name = 'InsufficientRoleError';
  }
}

export class EventNotInDraftError extends Error {
  constructor() {
    super('Event can only be edited while in DRAFT status');
    this.name = 'EventNotInDraftError';
  }
}

export class EventVersionConflictError extends Error {
  constructor() {
    super('Event was modified by another request; please refresh and try again');
    this.name = 'EventVersionConflictError';
  }
}
