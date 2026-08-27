import { UpdateEventConfigurationUseCase } from './update-event-configuration.use-case';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
  EventVenueNotFoundError,
  EventVenueOrganizationMismatchError,
  InsufficientRoleError,
  InvalidDateRangeError,
  InvalidTimezoneError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import type { IEventRepository } from '../../domain/ports/event-repository.port';
import type { IOrganizationAccessPort } from '../../domain/ports/organization-access.port';
import type { IVenueAccessPort } from '../../../venues/contracts/venue-access.contract';
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

describe('UpdateEventConfigurationUseCase', () => {
  let useCase: UpdateEventConfigurationUseCase;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;
  let venueAccess: jest.Mocked<IVenueAccessPort>;

  beforeEach(() => {
    eventRepository = {
      create: jest.fn(),
      findByOrganizationAndId: jest.fn(),
      findByOrganization: jest.fn(),
      update: jest.fn(),
      updateConfiguration: jest.fn(),
    };
    orgAccess = { findMember: jest.fn() };
    venueAccess = { findVenue: jest.fn() };
    useCase = new UpdateEventConfigurationUseCase(eventRepository, orgAccess, venueAccess);
  });

  it('updates format when actor is OWNER and version matches', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ format: 'IN_PERSON', version: 2 }),
    );

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      format: 'IN_PERSON',
    });

    expect(result.format).toBe('IN_PERSON');
    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'IN_PERSON', expectedVersion: 1 }),
    );
  });

  it('updates venueId when venue belongs to same org', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    venueAccess.findVenue.mockResolvedValue({ id: 'venue-1', organizationId: 'org-1' });
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ venueId: 'venue-1', version: 2 }),
    );

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      venueId: 'venue-1',
    });

    expect(result.venueId).toBe('venue-1');
  });

  it('clears venueId when set to null', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ venueId: 'venue-1' }));
    eventRepository.updateConfiguration.mockResolvedValue(makeEvent({ venueId: null, version: 2 }));

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      venueId: null,
    });

    expect(venueAccess.findVenue).not.toHaveBeenCalled();
    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: null }),
    );
  });

  it('updates startsAt and endsAt when endsAt is after startsAt', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    const startsAt = new Date('2026-08-01T18:00:00Z');
    const endsAt = new Date('2026-08-01T22:00:00Z');
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ startsAt, endsAt, version: 2 }),
    );

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      startsAt,
      endsAt,
    });

    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ startsAt, endsAt }),
    );
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'x',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
    expect(eventRepository.updateConfiguration).not.toHaveBeenCalled();
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(EventNotFoundError);
  });

  it('throws EventNotInDraftError when event is not DRAFT', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ status: 'PUBLISHED' }));

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(EventNotInDraftError);
  });

  it('throws EventVersionConflictError when version does not match', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ version: 3 }));

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(EventVersionConflictError);
  });

  it('throws InvalidTimezoneError for invalid IANA timezone', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        timezone: 'Not/ATimezone',
      }),
    ).rejects.toThrow(InvalidTimezoneError);
  });

  it('throws InvalidDateRangeError when endsAt is before startsAt', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        startsAt: new Date('2026-08-01T22:00:00Z'),
        endsAt: new Date('2026-08-01T18:00:00Z'),
      }),
    ).rejects.toThrow(InvalidDateRangeError);
  });

  it('throws EventVenueNotFoundError when venue does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    venueAccess.findVenue.mockResolvedValue(null);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        venueId: 'nonexistent-venue',
      }),
    ).rejects.toThrow(EventVenueNotFoundError);
  });

  it('throws EventVenueOrganizationMismatchError when venue belongs to different org', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    venueAccess.findVenue.mockResolvedValue({ id: 'venue-1', organizationId: 'org-other' });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        venueId: 'venue-1',
      }),
    ).rejects.toThrow(EventVenueOrganizationMismatchError);
  });

  it('delegates currency lock enforcement to the atomic repository operation', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ currency: 'BRL' }));
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ currency: 'USD', version: 2 }),
    );

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'u',
      expectedVersion: 1,
      currency: 'USD',
    });

    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });

  it('allows setting the same currency value', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ currency: 'BRL' }));
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ currency: 'BRL', version: 2 }),
    );
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        currency: 'BRL',
      }),
    ).resolves.toBeDefined();
  });

  it('validates endsAt against existing startsAt when only endsAt is updated', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    const existingStartsAt = new Date('2026-08-01T20:00:00Z');
    eventRepository.findByOrganizationAndId.mockResolvedValue(
      makeEvent({ startsAt: existingStartsAt }),
    );

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        endsAt: new Date('2026-08-01T18:00:00Z'),
      }),
    ).rejects.toThrow(InvalidDateRangeError);
  });

  it('preserves onlineInfo when it is omitted while changing format', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(
      makeEvent({ format: 'ONLINE', onlineInfo: 'private-access' }),
    );
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ format: 'IN_PERSON', onlineInfo: 'private-access', version: 2 }),
    );

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'u',
      expectedVersion: 1,
      format: 'IN_PERSON',
    });

    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.not.objectContaining({ onlineInfo: expect.anything() }),
    );
  });

  it('clears onlineInfo only when clearOnlineInfo is explicitly true', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(
      makeEvent({ onlineInfo: 'private-access' }),
    );
    eventRepository.updateConfiguration.mockResolvedValue(
      makeEvent({ onlineInfo: null, version: 2 }),
    );

    await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'u',
      expectedVersion: 1,
      clearOnlineInfo: true,
    });

    expect(eventRepository.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ onlineInfo: null }),
    );
  });

  it.each([
    { onlineInfo: null },
    { onlineInfo: '' },
    { onlineInfo: '   ' },
    { onlineInfo: 'x'.repeat(2001) },
    { onlineInfo: 'private-access', clearOnlineInfo: true },
  ])('rejects an invalid online configuration command: %p', async (onlineUpdate) => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        actorId: 'u',
        expectedVersion: 1,
        ...onlineUpdate,
      }),
    ).rejects.toThrow('Invalid online configuration update');

    expect(eventRepository.updateConfiguration).not.toHaveBeenCalled();
  });
});
