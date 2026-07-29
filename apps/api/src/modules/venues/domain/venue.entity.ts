export class Venue {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly address: string,
    public readonly city: string,
    public readonly state: string,
    public readonly country: string,
    public readonly postalCode: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
