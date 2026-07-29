import { CreateTicketTypeUseCase } from './create-ticket-type.use-case';
import {
  EventCurrencyNotSetError,
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
  format: 'IN_PERSON',
  startsAt: null,
  endsAt: null,
  timezone: null,
  onlineInfo: null,
  venueId: null,
  currency: 'BRL',
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

const makePrisma = () => ({
  idempotencyRecord: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('CreateTicketTypeUseCase', () => {
  let useCase: CreateTicketTypeUseCase;
  let ticketTypeRepository: jest.Mocked<ITicketTypeRepository>;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ticketTypeRepository = {
      create: jest.fn(),
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
    prisma = makePrisma();
    useCase = new CreateTicketTypeUseCase(
      ticketTypeRepository,
      eventRepository,
      orgAccess,
      prisma as never,
    );
  });

  it('creates ticket type when actor is OWNER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    ticketTypeRepository.create.mockResolvedValue(makeTicketType());

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      idempotencyKey: 'key-1',
      name: 'General',
      description: null,
      priceAmount: 5000,
      capacity: 100,
    });

    expect(result.cached).toBe(false);
    expect(result.ticketType.name).toBe('General');
    expect(ticketTypeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'General', priceAmount: 5000, capacity: 100 }),
    );
  });

  it('returns cached result when idempotency key is reused', async () => {
    const cachedBody = {
      id: 'tt-cached', eventId: 'evt-1', organizationId: 'org-1', name: 'Cached',
      description: null, priceAmount: 5000, capacity: 100, status: 'ACTIVE', version: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      idempotencyKey: 'key-1', completedAt: new Date(), responseBody: cachedBody,
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      idempotencyKey: 'key-1',
      name: 'General',
      description: null,
      priceAmount: 5000,
      capacity: 100,
    });

    expect(result.cached).toBe(true);
    expect(result.ticketType.id).toBe('tt-cached');
    expect(ticketTypeRepository.create).not.toHaveBeenCalled();
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    orgAccess.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', idempotencyKey: 'k', name: 'G', description: null, priceAmount: 0, capacity: 1 }),
    ).rejects.toThrow(OrganizationAccessDeniedError);
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', idempotencyKey: 'k', name: 'G', description: null, priceAmount: 0, capacity: 1 }),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', idempotencyKey: 'k', name: 'G', description: null, priceAmount: 0, capacity: 1 }),
    ).rejects.toThrow(EventNotFoundError);
  });

  it('throws EventNotInDraftError when event is not DRAFT', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ status: 'PUBLISHED' }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', idempotencyKey: 'k', name: 'G', description: null, priceAmount: 0, capacity: 1 }),
    ).rejects.toThrow(EventNotInDraftError);
  });

  it('throws EventCurrencyNotSetError when event has no currency', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ currency: null }));

    await expect(
      useCase.execute({ organizationId: 'org-1', eventId: 'evt-1', actorId: 'x', idempotencyKey: 'k', name: 'G', description: null, priceAmount: 0, capacity: 1 }),
    ).rejects.toThrow(EventCurrencyNotSetError);
  });
});
