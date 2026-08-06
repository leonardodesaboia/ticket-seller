import type {
  IPublishEventOperationPort,
  PublishedEventData,
} from '../ports/publish-event-operation.port';
import type { IOrganizationAccessPort } from '../../domain/ports/organization-access.port';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import { PublishEventUseCase } from './publish-event.use-case';

const makePublished = (overrides: Partial<PublishedEventData> = {}): PublishedEventData => ({
  id: 'evt-1',
  organizationId: 'org-1',
  title: 'My Event',
  description: null,
  status: 'PUBLISHED',
  version: 5,
  format: 'IN_PERSON',
  startsAt: new Date().toISOString(),
  endsAt: new Date().toISOString(),
  timezone: 'America/Fortaleza',
  venueId: 'venue-1',
  currency: 'BRL',
  onlineConfigured: false,
  slug: 'my-event-evt-1',
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('PublishEventUseCase', () => {
  let useCase: PublishEventUseCase;
  let operation: jest.Mocked<IPublishEventOperationPort>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  const execute = (overrides: Partial<Parameters<PublishEventUseCase['execute']>[0]> = {}) =>
    useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      idempotencyKey: 'key-1',
      expectedVersion: 4,
      ...overrides,
    });

  beforeEach(() => {
    operation = { execute: jest.fn() };
    orgAccess = { findMember: jest.fn() };
    useCase = new PublishEventUseCase(operation, orgAccess);
  });

  it('delegates one atomic publish operation when actor is EVENT_MANAGER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'EVENT_MANAGER', status: 'ACTIVE' });
    operation.execute.mockResolvedValue({ event: makePublished(), cached: false });

    const result = await execute();

    expect(result.cached).toBe(false);
    expect(result.event.status).toBe('PUBLISHED');
    expect(operation.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        scopedKey: 'event-publish:org-1:evt-1:user-1:key-1',
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'user-1',
        expectedVersion: 4,
        now: expect.any(Date),
      }),
    );
  });

  it('derives a different request hash when the expected version differs', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    operation.execute.mockResolvedValue({ event: makePublished(), cached: false });

    await execute({ expectedVersion: 4 });
    await execute({ expectedVersion: 5 });

    const firstHash = operation.execute.mock.calls[0]?.[0].requestHash;
    const secondHash = operation.execute.mock.calls[1]?.[0].requestHash;
    expect(firstHash).toBeDefined();
    expect(secondHash).toBeDefined();
    expect(firstHash).not.toBe(secondHash);
  });

  it('returns the cached result supplied by the atomic operation', async () => {
    const cached = makePublished({ id: 'evt-cached' });
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    operation.execute.mockResolvedValue({ event: cached, cached: true });

    await expect(execute()).resolves.toEqual({ event: cached, cached: true });
  });

  it('rejects a non-member before touching the operation', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(execute()).rejects.toThrow(OrganizationAccessDeniedError);
    expect(operation.execute).not.toHaveBeenCalled();
  });

  it('rejects a suspended membership before touching the operation', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'SUSPENDED' });

    await expect(execute()).rejects.toThrow(OrganizationAccessDeniedError);
    expect(operation.execute).not.toHaveBeenCalled();
  });

  it('rejects an insufficient role before touching the operation', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(execute()).rejects.toThrow(InsufficientRoleError);
    expect(operation.execute).not.toHaveBeenCalled();
  });
});
