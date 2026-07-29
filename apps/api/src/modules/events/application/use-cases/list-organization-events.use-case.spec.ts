import { ListOrganizationEventsUseCase } from './list-organization-events.use-case';
import { OrganizationAccessDeniedError } from '../../domain/event.errors';
import type { IEventRepository, ListEventsResult } from '../../domain/ports/event-repository.port';
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
  createdAt: new Date('2026-07-29T10:00:00Z'),
  updatedAt: new Date('2026-07-29T10:00:00Z'),
  ...overrides,
});

const makeResult = (overrides: Partial<ListEventsResult> = {}): ListEventsResult => ({
  events: [makeEvent()],
  nextCursor: null,
  ...overrides,
});

describe('ListOrganizationEventsUseCase', () => {
  let useCase: ListOrganizationEventsUseCase;
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
    useCase = new ListOrganizationEventsUseCase(eventRepository, orgAccess);
  });

  it('returns events when actor is an active member', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    eventRepository.findByOrganization.mockResolvedValue(makeResult());

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorId: 'user-1',
      limit: 20,
    });

    expect(result.events).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(eventRepository.findByOrganization).toHaveBeenCalledWith({
      organizationId: 'org-1',
      cursor: undefined,
      limit: 20,
    });
  });

  it('caps limit at 100', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganization.mockResolvedValue(makeResult());

    await useCase.execute({ organizationId: 'org-1', actorId: 'user-1', limit: 999 });

    expect(eventRepository.findByOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('passes cursor to repository', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    eventRepository.findByOrganization.mockResolvedValue(makeResult());

    await useCase.execute({
      organizationId: 'org-1',
      actorId: 'user-1',
      cursor: 'abc123',
      limit: 20,
    });

    expect(eventRepository.findByOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'abc123' }),
    );
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', actorId: 'user-x', limit: 20 }),
    ).rejects.toThrow(OrganizationAccessDeniedError);

    expect(eventRepository.findByOrganization).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when member is not ACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'INVITED' });

    await expect(
      useCase.execute({ organizationId: 'org-1', actorId: 'user-1', limit: 20 }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
  });

  it('returns nextCursor when there are more pages', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    eventRepository.findByOrganization.mockResolvedValue(makeResult({ nextCursor: 'cursor-abc' }));

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorId: 'user-1',
      limit: 20,
    });

    expect(result.nextCursor).toBe('cursor-abc');
  });
});
