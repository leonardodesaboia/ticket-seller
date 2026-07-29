import { CreateEventUseCase } from './create-event.use-case';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import type { IEventRepository } from '../../domain/ports/event-repository.port';
import type { IOrganizationAccessPort } from '../../domain/ports/organization-access.port';
import type { Event } from '../../domain/event.entity';

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-1',
  organizationId: 'org-1',
  title: 'My Event',
  description: null,
  status: 'DRAFT',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CreateEventUseCase', () => {
  let useCase: CreateEventUseCase;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  beforeEach(() => {
    eventRepository = { create: jest.fn(), findByOrganizationAndId: jest.fn() };
    orgAccess = { findMember: jest.fn() };
    useCase = new CreateEventUseCase(eventRepository, orgAccess);
  });

  it('creates event in DRAFT when actor is OWNER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.create.mockResolvedValue(makeEvent());

    const result = await useCase.execute({
      organizationId: 'org-1',
      title: 'My Event',
      description: null,
      actorId: 'user-1',
    });

    expect(result.status).toBe('DRAFT');
    expect(eventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', title: 'My Event' }),
    );
  });

  it('creates event when actor is EVENT_MANAGER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'EVENT_MANAGER', status: 'ACTIVE' });
    eventRepository.create.mockResolvedValue(makeEvent());

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        title: 'Event',
        description: null,
        actorId: 'user-2',
      }),
    ).resolves.toBeDefined();
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        title: 'Event',
        description: null,
        actorId: 'user-x',
      }),
    ).rejects.toThrow(OrganizationAccessDeniedError);

    expect(eventRepository.create).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when member status is not ACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'INVITED' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        title: 'Event',
        description: null,
        actorId: 'user-1',
      }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        title: 'Event',
        description: null,
        actorId: 'user-1',
      }),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws InsufficientRoleError when actor is SUPPORT', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'SUPPORT', status: 'ACTIVE' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        title: 'Event',
        description: null,
        actorId: 'user-1',
      }),
    ).rejects.toThrow(InsufficientRoleError);
  });
});
