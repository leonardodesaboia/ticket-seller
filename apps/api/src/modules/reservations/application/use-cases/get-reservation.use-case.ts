import { createHash } from 'crypto';
import {
  type IReservationRepository,
  type ReservationView,
} from '../../domain/ports/reservation-repository.port';

export class GetReservationUseCase {
  constructor(private readonly repository: IReservationRepository) {}

  execute(reservationId: string, token: string): Promise<ReservationView> {
    return this.repository.get(reservationId, createHash('sha256').update(token).digest('hex'));
  }
}
