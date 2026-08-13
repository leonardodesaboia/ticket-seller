import type { IPublicEventQueryPort, PublicEventDetail } from '../ports/public-event-query.port';
import { PublicEventNotFoundError } from '../errors/public-catalog.errors';
import { GetPublicEventUseCase } from './get-public-event.use-case';

const detail: PublicEventDetail = {
  slug: 'rock-fest-evt-1',
  organizationId: 'org-id-1',
  title: 'Rock Fest',
  description: null,
  format: 'IN_PERSON',
  startsAt: new Date(),
  endsAt: new Date(),
  timezone: 'America/Fortaleza',
  currency: 'BRL',
  venue: null,
  ticketTypes: [],
};

describe('GetPublicEventUseCase', () => {
  let useCase: GetPublicEventUseCase;
  let queryPort: jest.Mocked<IPublicEventQueryPort>;

  beforeEach(() => {
    queryPort = { listPublished: jest.fn(), findPublishedBySlug: jest.fn() };
    useCase = new GetPublicEventUseCase(queryPort);
  });

  it('returns the published detail for a known slug', async () => {
    queryPort.findPublishedBySlug.mockResolvedValue(detail);

    await expect(useCase.execute('rock-fest-evt-1')).resolves.toEqual(detail);
  });

  it('throws PublicEventNotFoundError when the slug is not a published event', async () => {
    queryPort.findPublishedBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(PublicEventNotFoundError);
  });
});
