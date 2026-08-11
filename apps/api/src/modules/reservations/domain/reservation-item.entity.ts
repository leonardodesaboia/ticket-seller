export interface ReservationItemProps {
  id: string;
  ticketTypeId: string;
  quantity: number;
  name: string;
  unitPriceAmount: bigint;
  subtotalAmount: bigint;
  currency: string;
}

export class ReservationItem {
  constructor(readonly props: Readonly<ReservationItemProps>) {
    if (!Number.isInteger(props.quantity) || props.quantity <= 0) {
      throw new Error('Reservation item quantity must be a positive integer');
    }
  }
}
