import { createHash } from 'crypto';
import type { IReservationRepository, ReservationView } from '../../domain/ports/reservation-repository.port';
import { GetReservationUseCase } from './get-reservation.use-case';

describe('GetReservationUseCase', () => {
  it('passes only the SHA-256 hash of the continuation token to the repository', async () => {
    const repository: jest.Mocked<IReservationRepository> = {
      create: jest.fn(),
      get: jest.fn(),
      cancel: jest.fn(),
      expireActiveReservations: jest.fn(),
    };
    const view: ReservationView = {
      reservationId: 'reservation-id',
      status: 'ACTIVE',
      expiresAt: '2026-08-11T12:15:00.000Z',
      currency: 'BRL',
      subtotalAmount: 0,
      items: [],
    };
    repository.get.mockResolvedValue(view);

    await expect(new GetReservationUseCase(repository).execute('reservation-id', 'plain-token')).resolves.toBe(
      view,
    );
    expect(repository.get).toHaveBeenCalledWith(
      'reservation-id',
      createHash('sha256').update('plain-token').digest('hex'),
    );
  });
});
