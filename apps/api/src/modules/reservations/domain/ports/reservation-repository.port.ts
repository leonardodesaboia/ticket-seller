import type { ReservationStatus } from '../reservation.entity';

export interface ReservationItemInput {
  ticketTypeId: string;
  quantity: number;
}

export interface ReservationViewItem {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceAmount: number;
  subtotalAmount: number;
}

export interface ReservationView {
  reservationId: string;
  status: ReservationStatus;
  expiresAt: string;
  currency: string;
  subtotalAmount: number;
  items: ReservationViewItem[];
}

export interface CreateReservationOperationInput {
  eventSlug: string;
  items: ReservationItemInput[];
  idempotencyKey: string;
  requestHash: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface CreateReservationOperationResult {
  reservation: ReservationView;
  replayed: boolean;
}

export interface IReservationRepository {
  create(input: CreateReservationOperationInput): Promise<CreateReservationOperationResult>;
  get(reservationId: string, tokenHash: string): Promise<ReservationView>;
  cancel(reservationId: string, tokenHash: string): Promise<void>;
  expireActiveReservations(): Promise<number>;
}

export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');
