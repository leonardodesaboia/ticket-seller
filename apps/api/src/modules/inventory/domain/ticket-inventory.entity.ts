export interface TicketInventoryProps {
  id: string;
  ticketTypeId: string;
  eventId: string;
  organizationId: string;
  capacity: number;
  reserved: number;
  committed: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketInventory {
  readonly id: string;
  readonly ticketTypeId: string;
  readonly eventId: string;
  readonly organizationId: string;
  readonly capacity: number;
  readonly reserved: number;
  readonly committed: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: TicketInventoryProps) {
    if (props.capacity <= 0) {
      throw new Error('TicketInventory invariant violated: capacity must be greater than 0');
    }
    if (props.reserved < 0) {
      throw new Error('TicketInventory invariant violated: reserved must be >= 0');
    }
    if (props.committed < 0) {
      throw new Error('TicketInventory invariant violated: committed must be >= 0');
    }
    if (props.reserved + props.committed > props.capacity) {
      throw new Error(
        'TicketInventory invariant violated: reserved + committed exceeds capacity',
      );
    }

    this.id = props.id;
    this.ticketTypeId = props.ticketTypeId;
    this.eventId = props.eventId;
    this.organizationId = props.organizationId;
    this.capacity = props.capacity;
    this.reserved = props.reserved;
    this.committed = props.committed;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get available(): number {
    return this.capacity - this.reserved - this.committed;
  }
}
