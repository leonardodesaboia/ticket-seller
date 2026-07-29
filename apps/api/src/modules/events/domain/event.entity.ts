export class Event {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly status: string,
    public readonly version: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
