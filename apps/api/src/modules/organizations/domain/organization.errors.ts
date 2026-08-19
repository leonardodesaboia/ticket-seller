export class SlugAlreadyInUseError extends Error {
  constructor(slug: string) {
    super(`Slug already in use: ${slug}`);
    this.name = 'SlugAlreadyInUseError';
  }
}

export class MemberNotFoundError extends Error {
  constructor() {
    super('Member not found');
    this.name = 'MemberNotFoundError';
  }
}

export class LastOwnerProtectionError extends Error {
  constructor() {
    super('Cannot modify member: organization must have at least one active OWNER');
    this.name = 'LastOwnerProtectionError';
  }
}

export class InvitationAlreadyUsedError extends Error {
  constructor() {
    super('Invitation has already been used');
    this.name = 'InvitationAlreadyUsedError';
  }
}
