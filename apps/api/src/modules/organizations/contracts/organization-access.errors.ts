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
