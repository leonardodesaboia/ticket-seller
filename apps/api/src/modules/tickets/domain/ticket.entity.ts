export type TicketStatus = 'ACTIVE' | 'CANCELLED';

export interface TicketProps {
  id: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  orderItemId: string;
  ticketTypeId: string;
  unitIndex: number;
  publicCode: string;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Ticket {
  readonly id: string;
  readonly organizationId: string;
  readonly eventId: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly ticketTypeId: string;
  readonly unitIndex: number;
  readonly publicCode: string;
  readonly status: TicketStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: TicketProps) {
    if (props.unitIndex < 0) throw new Error('unitIndex must be >= 0');
    if (props.publicCode.length !== 64) throw new Error('publicCode must be 64 hex chars');
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.eventId = props.eventId;
    this.orderId = props.orderId;
    this.orderItemId = props.orderItemId;
    this.ticketTypeId = props.ticketTypeId;
    this.unitIndex = props.unitIndex;
    this.publicCode = props.publicCode;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
