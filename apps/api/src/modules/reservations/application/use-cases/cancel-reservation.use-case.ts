import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RESERVATION_REPOSITORY, type IReservationRepository } from '../../domain/ports/reservation-repository.port';

@Injectable()
export class CancelReservationUseCase {
  constructor(@Inject(RESERVATION_REPOSITORY) private readonly repository: IReservationRepository) {}

  execute(reservationId: string, token: string): Promise<void> {
    return this.repository.cancel(reservationId, createHash('sha256').update(token).digest('hex'));
  }
}
