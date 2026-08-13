import type { ReservationView } from '../../domain/ports/reservation-repository.port';

export class ReservationItemResponse {
  ticketTypeId!: string;
  name!: string;
  quantity!: number;
  unitPriceAmount!: number;
  subtotalAmount!: number;
}

export class ReservationResponse {
  reservationId!: string;
  token?: string;
  status!: string;
  expiresAt!: string;
  currency!: string;
  subtotalAmount!: number;
  items!: ReservationItemResponse[];

  static from(view: ReservationView, token?: string): ReservationResponse {
    return {
      reservationId: view.reservationId,
      ...(token ? { token } : {}),
      status: view.status,
      expiresAt: view.expiresAt,
      currency: view.currency,
      subtotalAmount: view.subtotalAmount,
      items: view.items.map((item) => ({ ...item })),
    };
  }
}
