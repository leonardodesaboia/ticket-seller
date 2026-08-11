import { createHash } from 'crypto';
import type { IReservationRepository, ReservationView } from '../../domain/ports/reservation-repository.port';
import { CreateReservationUseCase } from './create-reservation.use-case';

const reservation: ReservationView = {
  reservationId: 'reservation-id',
  status: 'ACTIVE',
  expiresAt: '2026-08-11T12:15:00.000Z',
  currency: 'BRL',
  subtotalAmount: 10000,
  items: [],
};

describe('CreateReservationUseCase', () => {
  const createRepository = (): jest.Mocked<IReservationRepository> => ({
    create: jest.fn(),
    get: jest.fn(),
    cancel: jest.fn(),
    expireActiveReservations: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-11T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('creates a 32-byte continuation token, hashes it and uses the server-owned 15 minute TTL', async () => {
    const repository = createRepository();
    repository.create.mockResolvedValue({ reservation, replayed: false });
    const useCase = new CreateReservationUseCase(repository);

    const result = await useCase.execute({
      eventSlug: 'my-event',
      items: [{ ticketTypeId: 'b-ticket', quantity: 1 }],
      idempotencyKey: 'key-1',
    });

    expect(result).toMatchObject({ reservation, token: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const createInput = repository.create.mock.calls[0]![0];
    expect(createInput.expiresAt).toEqual(new Date('2026-08-11T12:15:00.000Z'));
    expect(createInput.tokenHash).toBe(createHash('sha256').update(result.token!).digest('hex'));
  });

  it('hashes equivalent item lists canonically so order does not change idempotency identity', async () => {
    const repository = createRepository();
    repository.create.mockResolvedValue({ reservation, replayed: false });
    const useCase = new CreateReservationUseCase(repository);
    const base = { eventSlug: 'my-event', idempotencyKey: 'key-1' };

    await useCase.execute({
      ...base,
      items: [
        { ticketTypeId: 'b-ticket', quantity: 1 },
        { ticketTypeId: 'a-ticket', quantity: 2 },
      ],
    });
    await useCase.execute({
      ...base,
      items: [
        { ticketTypeId: 'a-ticket', quantity: 2 },
        { ticketTypeId: 'b-ticket', quantity: 1 },
      ],
    });

    expect(repository.create.mock.calls[0]![0].requestHash).toBe(
      repository.create.mock.calls[1]![0].requestHash,
    );
  });

  it('does not return a continuation token on an idempotent replay', async () => {
    const repository = createRepository();
    repository.create.mockResolvedValue({ reservation, replayed: true });

    await expect(
      new CreateReservationUseCase(repository).execute({
        eventSlug: 'my-event',
        items: [{ ticketTypeId: 'ticket-id', quantity: 1 }],
        idempotencyKey: 'key-1',
      }),
    ).resolves.toEqual({ reservation });
  });
});
