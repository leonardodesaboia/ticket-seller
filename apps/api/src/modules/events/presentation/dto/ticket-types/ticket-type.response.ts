import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';

export class TicketTypeResponse {
  id!: string;
  eventId!: string;
  organizationId!: string;
  name!: string;
  description!: string | null;
  priceAmount!: number;
  capacity!: number;
  status!: string;
  version!: number;
  createdAt!: string;
  updatedAt!: string;

  static from(tt: TicketType): TicketTypeResponse {
    const res = new TicketTypeResponse();
    res.id = tt.id;
    res.eventId = tt.eventId;
    res.organizationId = tt.organizationId;
    res.name = tt.name;
    res.description = tt.description;
    res.priceAmount = tt.priceAmount;
    res.capacity = tt.capacity;
    res.status = tt.status;
    res.version = tt.version;
    res.createdAt = tt.createdAt.toISOString();
    res.updatedAt = tt.updatedAt.toISOString();
    return res;
  }
}
