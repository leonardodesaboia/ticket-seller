import { createHash } from 'crypto';
import type { IReservationRepository } from '../../domain/ports/reservation-repository.port';
import { CancelReservationUseCase } from './cancel-reservation.use-case';

describe('CancelReservationUseCase', () => {
  it('passes only the SHA-256 hash of the continuation token to the repository', async () => {
    const repository: jest.Mocked<IReservationRepository> = {
      create: jest.fn(),
      get: jest.fn(),
      cancel: jest.fn(),
      expireActiveReservations: jest.fn(),
    };
    repository.cancel.mockResolvedValue(undefined);

    await new CancelReservationUseCase(repository).execute('reservation-id', 'plain-token');

    expect(repository.cancel).toHaveBeenCalledWith(
      'reservation-id',
      createHash('sha256').update('plain-token').digest('hex'),
    );
  });
});
