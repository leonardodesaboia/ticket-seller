import { createHash } from 'crypto';
import { type IReservationRepository } from '../../domain/ports/reservation-repository.port';

export class CancelReservationUseCase {
  constructor(private readonly repository: IReservationRepository) {}

  execute(reservationId: string, token: string): Promise<void> {
    return this.repository.cancel(reservationId, createHash('sha256').update(token).digest('hex'));
  }
}
