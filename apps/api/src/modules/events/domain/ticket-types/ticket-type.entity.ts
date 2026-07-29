export class TicketType {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly priceAmount: number,
    public readonly capacity: number,
    public readonly status: string,
    public readonly version: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
