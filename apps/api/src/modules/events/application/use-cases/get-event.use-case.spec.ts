import { GetEventUseCase } from './get-event.use-case';
import { EventNotFoundError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import type { IEventRepository } from '../../domain/ports/event-repository.port';
import type { IOrganizationAccessPort } from '../../domain/ports/organization-access.port';
import type { Event } from '../../domain/event.entity';

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-1',
  organizationId: 'org-1',
  title: 'My Event',
  description: null,
  status: 'DRAFT',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('GetEventUseCase', () => {
  let useCase: GetEventUseCase;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  beforeEach(() => {
    eventRepository = {
      create: jest.fn(),
      findByOrganizationAndId: jest.fn(),
      findByOrganization: jest.fn(),
      update: jest.fn(),
    };
    orgAccess = { findMember: jest.fn() };
    useCase = new GetEventUseCase(eventRepository, orgAccess);
  });

  it('returns event when actor is an active member', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
    });

    expect(result.id).toBe('evt-1');
    expect(eventRepository.findByOrganizationAndId).toHaveBeenCalledWith('org-1', 'evt-1');
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'user-x' }),
    ).rejects.toThrow(OrganizationAccessDeniedError);

    expect(eventRepository.findByOrganizationAndId).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when member is not ACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'INVITED' });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'user-1' }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-missing', actorId: 'user-1' }),
    ).rejects.toThrow(EventNotFoundError);
  });

  it('throws EventNotFoundError when event belongs to a different org', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-2', eventId: 'evt-1', actorId: 'user-1' }),
    ).rejects.toThrow(EventNotFoundError);
  });
});
