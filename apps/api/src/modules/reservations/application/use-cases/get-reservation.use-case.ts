import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  type IReservationRepository,
  type ReservationView,
} from '../../domain/ports/reservation-repository.port';

@Injectable()
export class GetReservationUseCase {
  constructor(@Inject(RESERVATION_REPOSITORY) private readonly repository: IReservationRepository) {}

  execute(reservationId: string, token: string): Promise<ReservationView> {
    return this.repository.get(reservationId, createHash('sha256').update(token).digest('hex'));
  }
}
