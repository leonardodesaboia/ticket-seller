import { ApiProperty } from '@nestjs/swagger';
import { Ticket } from '../../domain/ticket.entity';

export class TicketItemResponse {
  @ApiProperty() ticketId!: string;
  @ApiProperty() orderItemId!: string;
  @ApiProperty() ticketTypeId!: string;
  @ApiProperty() unitIndex!: number;
  @ApiProperty() publicCode!: string;
  @ApiProperty() status!: string;
}

export class TicketsResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty({ type: [TicketItemResponse] }) tickets!: TicketItemResponse[];

  static from(orderId: string, tickets: Ticket[]): TicketsResponse {
    const r = new TicketsResponse();
    r.orderId = orderId;
    r.tickets = tickets.map((t) => {
      const item = new TicketItemResponse();
      item.ticketId = t.id;
      item.orderItemId = t.orderItemId;
      item.ticketTypeId = t.ticketTypeId;
      item.unitIndex = t.unitIndex;
      item.publicCode = t.publicCode;
      item.status = t.status;
      return item;
    });
    return r;
  }
}
