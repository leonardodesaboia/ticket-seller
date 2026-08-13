import { UpdateEventUseCase } from './update-event.use-case';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
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
  format: null,
  startsAt: null,
  endsAt: null,
  timezone: null,
  onlineInfo: null,
  venueId: null,
  currency: null,
  slug: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UpdateEventUseCase', () => {
  let useCase: UpdateEventUseCase;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  beforeEach(() => {
    eventRepository = {
      create: jest.fn(),
      findByOrganizationAndId: jest.fn(),
      findByOrganization: jest.fn(),
      update: jest.fn(),
      updateConfiguration: jest.fn(),
    };
    orgAccess = { findMember: jest.fn() };
    useCase = new UpdateEventUseCase(eventRepository, orgAccess);
  });

  it('updates title when actor is OWNER and version matches', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    eventRepository.update.mockResolvedValue(makeEvent({ title: 'New Title', version: 2 }));

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      title: 'New Title',
      version: 1,
    });

    expect(result.title).toBe('New Title');
    expect(eventRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Title', expectedVersion: 1 }),
    );
  });

  it('updates description to null', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(
      makeEvent({ description: 'Old desc' }),
    );
    eventRepository.update.mockResolvedValue(makeEvent({ description: null, version: 2 }));

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      description: null,
      version: 1,
    });

    expect(eventRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', version: 1 }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
    expect(eventRepository.update).not.toHaveBeenCalled();
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'u', version: 1 }),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'u', version: 1 }),
    ).rejects.toThrow(EventNotFoundError);
  });

  it('throws EventNotInDraftError when event is not DRAFT', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ status: 'PUBLISHED' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'u', version: 1 }),
    ).rejects.toThrow(EventNotInDraftError);
  });

  it('throws EventVersionConflictError when version does not match', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ version: 3 }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'u', version: 1 }),
    ).rejects.toThrow(EventVersionConflictError);
  });

  it('does not pass title to repository when not provided', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    eventRepository.update.mockResolvedValue(makeEvent({ version: 2 }));

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'u',
      version: 1,
    });

    const callArg = eventRepository.update.mock.calls[0]?.[0];
    expect(callArg).not.toHaveProperty('title');
  });
});
