import { UpdateTicketTypeUseCase } from './update-ticket-type.use-case';
import {
  TicketTypeNotFoundError,
  TicketTypeVersionConflictError,
} from '../../../domain/ticket-types/ticket-type.errors';
import {
  EventNotFoundError,
  EventNotInDraftError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../../domain/event.errors';
import type { ITicketTypeRepository } from '../../../domain/ticket-types/ticket-type-repository.port';
import type { IEventRepository } from '../../../domain/ports/event-repository.port';
import type { IOrganizationAccessPort } from '../../../domain/ports/organization-access.port';
import type { Event } from '../../../domain/event.entity';
import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';

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
  currency: 'BRL',
  slug: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeTicketType = (overrides: Partial<TicketType> = {}): TicketType => ({
  id: 'tt-1',
  eventId: 'evt-1',
  organizationId: 'org-1',
  name: 'General',
  description: null,
  priceAmount: 5000,
  capacity: 100,
  status: 'ACTIVE',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UpdateTicketTypeUseCase', () => {
  let useCase: UpdateTicketTypeUseCase;
  let ticketTypeRepository: jest.Mocked<ITicketTypeRepository>;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  beforeEach(() => {
    ticketTypeRepository = {
      findByEventAndId: jest.fn(),
      findByEvent: jest.fn(),
      update: jest.fn(),
      countActiveByEvent: jest.fn(),
    };
    eventRepository = {
      create: jest.fn(),
      findByOrganizationAndId: jest.fn(),
      findByOrganization: jest.fn(),
      update: jest.fn(),
      updateConfiguration: jest.fn(),
    };
    orgAccess = { findMember: jest.fn() };
    useCase = new UpdateTicketTypeUseCase(ticketTypeRepository, eventRepository, orgAccess);
  });

  it('updates name when actor is OWNER and version matches', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    ticketTypeRepository.findByEventAndId.mockResolvedValue(makeTicketType());
    ticketTypeRepository.update.mockResolvedValue(makeTicketType({ name: 'VIP', version: 2 }));

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      ticketTypeId: 'tt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      name: 'VIP',
    });

    expect(result.name).toBe('VIP');
  });

  it('deactivates ticket type when status is INACTIVE', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    ticketTypeRepository.findByEventAndId.mockResolvedValue(makeTicketType());
    ticketTypeRepository.update.mockResolvedValue(
      makeTicketType({ status: 'INACTIVE', version: 2 }),
    );

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      ticketTypeId: 'tt-1',
      actorId: 'user-1',
      expectedVersion: 1,
      status: 'INACTIVE',
    });

    expect(result.status).toBe('INACTIVE');
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        ticketTypeId: 'tt-1',
        actorId: 'x',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        ticketTypeId: 'tt-1',
        actorId: 'x',
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
        ticketTypeId: 'tt-1',
        actorId: 'x',
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
        ticketTypeId: 'tt-1',
        actorId: 'x',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(EventNotInDraftError);
  });

  it('throws TicketTypeNotFoundError when ticket type does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    ticketTypeRepository.findByEventAndId.mockResolvedValue(null);
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        ticketTypeId: 'tt-1',
        actorId: 'x',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(TicketTypeNotFoundError);
  });

  it('throws TicketTypeVersionConflictError when version does not match', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    ticketTypeRepository.findByEventAndId.mockResolvedValue(makeTicketType({ version: 3 }));
    await expect(
      useCase.execute({
        organizationId: 'org-1',
        eventId: 'evt-1',
        ticketTypeId: 'tt-1',
        actorId: 'x',
        expectedVersion: 1,
      }),
    ).rejects.toThrow(TicketTypeVersionConflictError);
  });
});
