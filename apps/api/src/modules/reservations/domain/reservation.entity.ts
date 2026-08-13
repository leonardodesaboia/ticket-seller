export type ReservationStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';

export interface ReservationProps {
  id: string;
  organizationId: string;
  eventId: string;
  status: ReservationStatus;
  expiresAt: Date;
  currency: string;
  subtotalAmount: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export class Reservation {
  constructor(readonly props: Readonly<ReservationProps>) {
    if (props.subtotalAmount < 0n) throw new Error('Reservation subtotal cannot be negative');
  }
}
