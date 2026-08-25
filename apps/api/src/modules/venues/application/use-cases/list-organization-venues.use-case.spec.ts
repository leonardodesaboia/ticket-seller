import { ListOrganizationVenuesUseCase } from './list-organization-venues.use-case';
import { Venue } from '../../domain/venue.entity';
import type { IVenueRepository } from '../../domain/ports/venue-repository.port';
import type { IOrganizationAccessPort } from '../../../events/domain/ports/organization-access.port';
import { OrganizationAccessDeniedError } from '../../../events/domain/event.errors';

function makeVenue(id: string): Venue {
  return new Venue(id, 'org-1', `Venue ${id}`, 'Rua A', 'Fortaleza', 'CE', 'BR', null, new Date(), new Date());
}

const makeVenueRepo = (): jest.Mocked<IVenueRepository> => ({
  create: jest.fn(),
  findByOrganization: jest.fn().mockResolvedValue([makeVenue('v-1'), makeVenue('v-2')]),
});

const makeOrgAccess = (): jest.Mocked<IOrganizationAccessPort> => ({
  findMember: jest.fn().mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' }),
});

describe('ListOrganizationVenuesUseCase', () => {
  let useCase: ListOrganizationVenuesUseCase;
  let venueRepo: jest.Mocked<IVenueRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  beforeEach(() => {
    venueRepo = makeVenueRepo();
    orgAccess = makeOrgAccess();
    useCase = new ListOrganizationVenuesUseCase(venueRepo, orgAccess);
  });

  it('returns all venues for an active member', async () => {
    const result = await useCase.execute({ organizationId: 'org-1', actorId: 'user-1' });

    expect(result).toHaveLength(2);
    expect(venueRepo.findByOrganization).toHaveBeenCalledWith('org-1');
  });

  it('returns empty array when no venues exist', async () => {
    venueRepo.findByOrganization.mockResolvedValue([]);

    const result = await useCase.execute({ organizationId: 'org-1', actorId: 'user-1' });

    expect(result).toEqual([]);
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', actorId: 'outsider' }),
    ).rejects.toBeInstanceOf(OrganizationAccessDeniedError);

    expect(venueRepo.findByOrganization).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when member is not ACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'SUSPENDED' });

    await expect(
      useCase.execute({ organizationId: 'org-1', actorId: 'user-1' }),
    ).rejects.toBeInstanceOf(OrganizationAccessDeniedError);
  });

  it('allows any active role to list venues (no capability restriction)', async () => {
    for (const role of ['OWNER', 'ADMIN', 'FINANCE', 'EVENT_MANAGER', 'CHECK_IN_STAFF']) {
      orgAccess.findMember.mockResolvedValue({ role, status: 'ACTIVE' });
      const result = await useCase.execute({ organizationId: 'org-1', actorId: 'user-1' });
      expect(result).toBeDefined();
    }
  });
});
