export class Event {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly status: string,
    public readonly version: number,
    public readonly format: string | null,
    public readonly startsAt: Date | null,
    public readonly endsAt: Date | null,
    public readonly timezone: string | null,
    public readonly onlineInfo: string | null,
    public readonly venueId: string | null,
    public readonly currency: string | null,
    public readonly slug: string | null,
    public readonly publishedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
