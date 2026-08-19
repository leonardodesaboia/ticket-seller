export class OrganizationInvitation {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly inviterId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly usedAt: Date | null,
    public readonly revokedAt: Date | null,
  ) {}

  get isPending(): boolean {
    return this.usedAt === null && this.revokedAt === null && this.expiresAt > new Date();
  }

  get isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  get isUsed(): boolean {
    return this.usedAt !== null;
  }

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }
}
