import { CreateVenueUseCase } from './create-venue.use-case';
import type { IVenueRepository } from '../../domain/ports/venue-repository.port';
import type { IOrganizationAccessPort } from '../../../events/domain/ports/organization-access.port';
import {
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../../events/domain/event.errors';
import { Venue } from '../../domain/venue.entity';

function makeVenue(overrides: Partial<ConstructorParameters<typeof Venue>[0] extends never ? Record<string, unknown> : object> = {}): Venue {
  return new Venue('venue-1', 'org-1', 'Main Stage', 'Rua A, 100', 'Fortaleza', 'CE', 'BR', null, new Date(), new Date());
}

const makeVenueRepo = (): jest.Mocked<IVenueRepository> => ({
  create: jest.fn().mockResolvedValue(makeVenue()),
  findByOrganization: jest.fn().mockResolvedValue([]),
});

const makeOrgAccess = (): jest.Mocked<IOrganizationAccessPort> => ({
  findMember: jest.fn().mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' }),
});

describe('CreateVenueUseCase', () => {
  let useCase: CreateVenueUseCase;
  let venueRepo: jest.Mocked<IVenueRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  const baseCommand = {
    organizationId: 'org-1',
    actorId: 'user-1',
    name: 'Main Stage',
    address: 'Rua A, 100',
    city: 'Fortaleza',
    state: 'CE',
    country: 'BR',
  };

  beforeEach(() => {
    venueRepo = makeVenueRepo();
    orgAccess = makeOrgAccess();
    useCase = new CreateVenueUseCase(venueRepo, orgAccess);
  });

  it('creates a venue for an OWNER actor', async () => {
    const result = await useCase.execute(baseCommand);

    expect(venueRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        name: 'Main Stage',
        city: 'Fortaleza',
      }),
    );
    expect(result).toMatchObject({ name: 'Main Stage', organizationId: 'org-1' });
  });

  it('creates a venue for an EVENT_MANAGER actor', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'EVENT_MANAGER', status: 'ACTIVE' });

    await useCase.execute(baseCommand);

    expect(venueRepo.create).toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(OrganizationAccessDeniedError);
    expect(venueRepo.create).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when member is not ACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'REMOVED' });

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(OrganizationAccessDeniedError);
  });

  it('throws InsufficientRoleError for a FINANCE actor', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'FINANCE', status: 'ACTIVE' });

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(InsufficientRoleError);
    expect(venueRepo.create).not.toHaveBeenCalled();
  });

  it('throws InsufficientRoleError for a CHECK_IN_STAFF actor', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'CHECK_IN_STAFF', status: 'ACTIVE' });

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(InsufficientRoleError);
  });

  it('passes postalCode when provided', async () => {
    await useCase.execute({ ...baseCommand, postalCode: '60000-000' });

    expect(venueRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '60000-000' }),
    );
  });

  it('omits postalCode from create input when not provided', async () => {
    await useCase.execute(baseCommand);

    const createInput = venueRepo.create.mock.calls[0]![0];
    expect(createInput).not.toHaveProperty('postalCode');
  });

  it('generates a unique id for each call', async () => {
    await useCase.execute(baseCommand);
    await useCase.execute(baseCommand);

    const firstId = venueRepo.create.mock.calls[0]![0].id;
    const secondId = venueRepo.create.mock.calls[1]![0].id;
    expect(firstId).not.toBe(secondId);
  });
});
