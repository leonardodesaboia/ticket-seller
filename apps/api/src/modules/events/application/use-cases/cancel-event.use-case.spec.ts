import { CancelEventUseCase } from './cancel-event.use-case';
import { IEventCancellationRepository } from '../ports/event-cancellation-repository.port';
import { EventNotFoundError, EventNotCancellableError } from '../../domain/event-cancellation.errors';

const makeRepo = (): jest.Mocked<IEventCancellationRepository> => ({
  getEventStatus: jest.fn(),
  cancelEvent: jest.fn(),
});

const ORG_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const EVENT_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const ACTOR_ID = 'cccccccc-0000-4000-8000-000000000003';

const cancelEventResult = {
  eventId: EVENT_ID,
  organizationId: ORG_ID,
  status: 'CANCELLED' as const,
  cancelledAt: new Date(),
  ordersCancelledCount: 3,
};

describe('CancelEventUseCase', () => {
  let useCase: CancelEventUseCase;
  let repo: jest.Mocked<IEventCancellationRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CancelEventUseCase(repo);
  });

  it('cancels a PUBLISHED event successfully', async () => {
    repo.getEventStatus.mockResolvedValue({ status: 'PUBLISHED' });
    repo.cancelEvent.mockResolvedValue(cancelEventResult);

    const result = await useCase.execute({ eventId: EVENT_ID, organizationId: ORG_ID, actorId: ACTOR_ID });

    expect(result.status).toBe('CANCELLED');
    expect(result.ordersCancelledCount).toBe(3);
    expect(repo.cancelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT_ID, organizationId: ORG_ID, actorId: ACTOR_ID }),
    );
  });

  it('cancels a DRAFT event successfully', async () => {
    repo.getEventStatus.mockResolvedValue({ status: 'DRAFT' });
    repo.cancelEvent.mockResolvedValue({ ...cancelEventResult, ordersCancelledCount: 0 });

    const result = await useCase.execute({ eventId: EVENT_ID, organizationId: ORG_ID });

    expect(result.status).toBe('CANCELLED');
    expect(repo.cancelEvent).toHaveBeenCalledTimes(1);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    repo.getEventStatus.mockResolvedValue(null);

    await expect(
      useCase.execute({ eventId: EVENT_ID, organizationId: ORG_ID }),
    ).rejects.toBeInstanceOf(EventNotFoundError);

    expect(repo.cancelEvent).not.toHaveBeenCalled();
  });

  it('throws EventNotCancellableError with EVENT_ALREADY_CANCELLED when event is already CANCELLED', async () => {
    repo.getEventStatus.mockResolvedValue({ status: 'CANCELLED' });

    const err = await useCase
      .execute({ eventId: EVENT_ID, organizationId: ORG_ID })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(EventNotCancellableError);
    expect((err as EventNotCancellableError).code).toBe('EVENT_ALREADY_CANCELLED');
    expect(repo.cancelEvent).not.toHaveBeenCalled();
  });

  it('throws EventNotCancellableError for events in non-cancellable states', async () => {
    repo.getEventStatus.mockResolvedValue({ status: 'ARCHIVED' });

    const err = await useCase
      .execute({ eventId: EVENT_ID, organizationId: ORG_ID })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(EventNotCancellableError);
    expect((err as EventNotCancellableError).code).toContain('NON_CANCELLABLE');
    expect(repo.cancelEvent).not.toHaveBeenCalled();
  });

  it('cancels orders in PENDING_PAYMENT and TICKETS_ISSUED states', async () => {
    repo.getEventStatus.mockResolvedValue({ status: 'PUBLISHED' });
    repo.cancelEvent.mockResolvedValue({ ...cancelEventResult, ordersCancelledCount: 5 });

    const result = await useCase.execute({ eventId: EVENT_ID, organizationId: ORG_ID, reason: 'Venue closed' });

    expect(result.ordersCancelledCount).toBe(5);
    expect(repo.cancelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Venue closed' }),
    );
  });
});
