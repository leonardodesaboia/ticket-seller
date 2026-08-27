import type {
  IPublicEventQueryPort,
  PublicEventListResult,
} from '../ports/public-event-query.port';
import { InvalidCursorError } from '../../domain/event.errors';
import { encodePublicCursor } from '../../domain/publication/public-cursor';
import { ListPublicEventsUseCase } from './list-public-events.use-case';

const emptyResult: PublicEventListResult = { events: [], nextCursor: null };

describe('ListPublicEventsUseCase', () => {
  let useCase: ListPublicEventsUseCase;
  let queryPort: jest.Mocked<IPublicEventQueryPort>;

  beforeEach(() => {
    queryPort = { listPublished: jest.fn(), findPublishedBySlug: jest.fn() };
    useCase = new ListPublicEventsUseCase(queryPort);
  });

  it('forwards the limit without a cursor when none is provided', async () => {
    queryPort.listPublished.mockResolvedValue(emptyResult);

    await useCase.execute({ limit: 20 });

    expect(queryPort.listPublished).toHaveBeenCalledWith({ limit: 20 });
  });

  it('decodes an opaque cursor and forwards the keyset position', async () => {
    queryPort.listPublished.mockResolvedValue(emptyResult);
    const startsAt = new Date('2026-09-01T18:00:00.000Z');
    const cursor = encodePublicCursor({ startsAt, id: 'evt-42' });

    await useCase.execute({ limit: 20, cursor });

    expect(queryPort.listPublished).toHaveBeenCalledWith({
      limit: 20,
      cursor: { startsAt, id: 'evt-42' },
    });
  });

  it('rejects a malformed cursor', async () => {
    await expect(useCase.execute({ limit: 20, cursor: 'not-a-valid-cursor' })).rejects.toThrow(
      InvalidCursorError,
    );
    expect(queryPort.listPublished).not.toHaveBeenCalled();
  });
});
