import type { ICreateTicketTypeOperationPort } from '../../ports/create-ticket-type-operation.port';
import type { Event } from '../../../domain/event.entity';
import {
  EventNotFoundError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../../domain/event.errors';
import type { IEventRepository } from '../../../domain/ports/event-repository.port';
import type { IOrganizationAccessPort } from '../../../domain/ports/organization-access.port';
import type { TicketType } from '../../../domain/ticket-types/ticket-type.entity';
import { CreateTicketTypeUseCase } from './create-ticket-type.use-case';

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

describe('CreateTicketTypeUseCase', () => {
  let useCase: CreateTicketTypeUseCase;
  let operation: jest.Mocked<ICreateTicketTypeOperationPort>;
  let eventRepository: jest.Mocked<IEventRepository>;
  let orgAccess: jest.Mocked<IOrganizationAccessPort>;

  const execute = (overrides: Partial<Parameters<CreateTicketTypeUseCase['execute']>[0]> = {}) =>
    useCase.execute({
      organizationId: 'org-1',
      eventId: 'evt-1',
      actorId: 'user-1',
      idempotencyKey: 'key-1',
      name: 'General',
      description: null,
      priceAmount: 5000,
      capacity: 100,
      ...overrides,
    });

  beforeEach(() => {
    operation = { execute: jest.fn() };
    eventRepository = {
      create: jest.fn(),
      findByOrganizationAndId: jest.fn(),
      findByOrganization: jest.fn(),
      update: jest.fn(),
      updateConfiguration: jest.fn(),
    };
    orgAccess = { findMember: jest.fn() };
    useCase = new CreateTicketTypeUseCase(operation, eventRepository, orgAccess);
  });

  it('delegates one atomic create operation when actor is OWNER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    operation.execute.mockResolvedValue({ ticketType: makeTicketType(), cached: false });

    const result = await execute();

    expect(result.cached).toBe(false);
    expect(result.ticketType.name).toBe('General');
    expect(operation.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        scopedKey: 'ticket-type-create:org-1:evt-1:key-1',
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        ticketType: expect.objectContaining({
          eventId: 'evt-1',
          organizationId: 'org-1',
          name: 'General',
          description: null,
          priceAmount: 5000,
          capacity: 100,
        }),
      }),
    );
  });

  it('returns the cached result supplied by the atomic operation', async () => {
    const cached = makeTicketType({ id: 'tt-cached' });
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    operation.execute.mockResolvedValue({ ticketType: cached, cached: true });

    await expect(execute()).resolves.toEqual({ ticketType: cached, cached: true });
  });

  it('includes description in the material request hash', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent());
    operation.execute.mockResolvedValue({ ticketType: makeTicketType(), cached: false });

    await execute({ description: 'First description' });
    await execute({ description: 'Different description' });

    const firstHash = operation.execute.mock.calls[0]?.[0].requestHash;
    const secondHash = operation.execute.mock.calls[1]?.[0].requestHash;
    expect(firstHash).toBeDefined();
    expect(secondHash).toBeDefined();
    expect(firstHash).not.toBe(secondHash);
  });

  it('throws OrganizationAccessDeniedError when actor is not a member', async () => {
    orgAccess.findMember.mockResolvedValue(null);

    await expect(execute()).rejects.toThrow(OrganizationAccessDeniedError);
    expect(operation.execute).not.toHaveBeenCalled();
  });

  it('throws InsufficientRoleError when actor is VIEWER', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(execute()).rejects.toThrow(InsufficientRoleError);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(null);

    await expect(execute()).rejects.toThrow(EventNotFoundError);
  });

  it('delegates DRAFT validation so a completed replay can succeed after publication', async () => {
    const cached = makeTicketType({ id: 'tt-cached' });
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ status: 'PUBLISHED' }));
    operation.execute.mockResolvedValue({ ticketType: cached, cached: true });

    await expect(execute()).resolves.toEqual({ ticketType: cached, cached: true });
    expect(operation.execute).toHaveBeenCalled();
  });

  it('delegates currency validation to the atomic operation', async () => {
    orgAccess.findMember.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    eventRepository.findByOrganizationAndId.mockResolvedValue(makeEvent({ currency: null }));
    operation.execute.mockResolvedValue({ ticketType: makeTicketType(), cached: false });

    await expect(execute()).resolves.toEqual({
      ticketType: expect.objectContaining({ id: 'tt-1' }),
      cached: false,
    });
  });
});
