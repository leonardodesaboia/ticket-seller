import type { IOrganizationAccessPort } from '../../domain/ports/organization-access.port';
import { EventNotFoundError, InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import { PublicationReadinessPolicy } from '../../domain/publication/publication-readiness.policy';
import type { IPublicationReadinessQueryPort } from '../ports/publication-readiness-query.port';
import { GetPublicationReadinessUseCase } from './get-publication-readiness.use-case';

const snapshot = {
  organizationStatus: 'ACTIVE',
  event: {
    id: 'event-1',
    organizationId: 'org-1',
    title: 'Festival',
    status: 'DRAFT',
    version: 4,
    format: 'IN_PERSON',
    startsAt: new Date('2099-01-01T18:00:00.000Z'),
    endsAt: new Date('2099-01-01T22:00:00.000Z'),
    timezone: 'UTC',
    onlineConfigured: false,
    venueId: 'venue-1',
    currency: 'BRL',
  },
  venue: { id: 'venue-1', organizationId: 'org-1' },
  ticketTypes: [
    {
      id: 'ticket-1',
      name: 'General',
      priceAmount: 5000,
      capacity: 100,
      status: 'ACTIVE',
    },
  ],
};

describe('GetPublicationReadinessUseCase', () => {
  let queryPort: jest.Mocked<IPublicationReadinessQueryPort>;
  let organizationAccess: jest.Mocked<IOrganizationAccessPort>;
  let useCase: GetPublicationReadinessUseCase;

  beforeEach(() => {
    queryPort = { findSnapshot: jest.fn() };
    organizationAccess = { findMember: jest.fn() };
    useCase = new GetPublicationReadinessUseCase(
      queryPort,
      organizationAccess,
      new PublicationReadinessPolicy(),
    );
  });

  it.each(['OWNER', 'ADMIN', 'EVENT_MANAGER'])(
    'returns readiness for an authorized %s',
    async (role) => {
      organizationAccess.findMember.mockResolvedValue({ role, status: 'ACTIVE' });
      queryPort.findSnapshot.mockResolvedValue(snapshot);

      await expect(
        useCase.execute({ organizationId: 'org-1', eventId: 'event-1', actorId: 'user-1' }),
      ).resolves.toEqual({ ready: true, version: 4, issues: [] });
      expect(queryPort.findSnapshot).toHaveBeenCalledWith('org-1', 'event-1');
    },
  );

  it('returns non-enumerable not found behavior for a non-member', async () => {
    organizationAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', actorId: 'outsider' }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
    expect(queryPort.findSnapshot).not.toHaveBeenCalled();
  });

  it('rejects an insufficient active role before querying event data', async () => {
    organizationAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', actorId: 'viewer' }),
    ).rejects.toThrow(InsufficientRoleError);
    expect(queryPort.findSnapshot).not.toHaveBeenCalled();
  });

  it('returns not found when the tenant-scoped snapshot does not exist', async () => {
    organizationAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    queryPort.findSnapshot.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'event-1', actorId: 'owner' }),
    ).rejects.toThrow(EventNotFoundError);
  });
});
