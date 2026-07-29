import {
  PublicationReadinessPolicy,
  type PublicationReadinessSnapshot,
} from './publication-readiness.policy';

const NOW = new Date('2029-01-01T12:00:00.000Z');

function makeSnapshot(
  overrides: {
    organizationStatus?: string;
    event?: Partial<PublicationReadinessSnapshot['event']>;
    venue?: PublicationReadinessSnapshot['venue'];
    ticketTypes?: PublicationReadinessSnapshot['ticketTypes'];
  } = {},
): PublicationReadinessSnapshot {
  return {
    organizationStatus: overrides.organizationStatus ?? 'ACTIVE',
    event: {
      id: 'event-1',
      organizationId: 'org-1',
      title: 'Festival',
      status: 'DRAFT',
      version: 4,
      format: 'IN_PERSON',
      startsAt: new Date('2030-01-01T18:00:00.000Z'),
      endsAt: new Date('2030-01-01T22:00:00.000Z'),
      timezone: 'America/Fortaleza',
      onlineConfigured: false,
      venueId: 'venue-1',
      currency: 'BRL',
      ...overrides.event,
    },
    venue:
      overrides.venue === undefined
        ? { id: 'venue-1', organizationId: 'org-1' }
        : overrides.venue,
    ticketTypes:
      overrides.ticketTypes ??
      [
        {
          id: 'ticket-1',
          name: 'General',
          priceAmount: 5000,
          capacity: 100,
          status: 'ACTIVE',
        },
      ],
  };
}

describe('PublicationReadinessPolicy', () => {
  const policy = new PublicationReadinessPolicy();

  it('returns ready for a fully valid event', () => {
    expect(policy.evaluate(makeSnapshot(), NOW)).toEqual({
      ready: true,
      version: 4,
      issues: [],
    });
  });

  it.each<
    [
      string,
      PublicationReadinessSnapshot,
      string,
    ]
  >([
    [
      'inactive organization',
      makeSnapshot({ organizationStatus: 'SUSPENDED' }),
      'ORGANIZATION_NOT_ACTIVE',
    ],
    ['published event', makeSnapshot({ event: { status: 'PUBLISHED' } }), 'EVENT_NOT_DRAFT'],
    ['blank title', makeSnapshot({ event: { title: '   ' } }), 'EVENT_TITLE_REQUIRED'],
    ['missing format', makeSnapshot({ event: { format: null } }), 'EVENT_FORMAT_REQUIRED'],
    ['invalid format', makeSnapshot({ event: { format: 'BROADCAST' } }), 'EVENT_FORMAT_INVALID'],
    ['missing start', makeSnapshot({ event: { startsAt: null } }), 'EVENT_STARTS_AT_REQUIRED'],
    ['missing end', makeSnapshot({ event: { endsAt: null } }), 'EVENT_ENDS_AT_REQUIRED'],
    ['missing timezone', makeSnapshot({ event: { timezone: null } }), 'EVENT_TIMEZONE_REQUIRED'],
    [
      'invalid timezone',
      makeSnapshot({ event: { timezone: 'Invalid/Timezone' } }),
      'EVENT_TIMEZONE_INVALID',
    ],
    [
      'invalid date range',
      makeSnapshot({
        event: {
          startsAt: new Date('2030-01-01T22:00:00.000Z'),
          endsAt: new Date('2030-01-01T18:00:00.000Z'),
        },
      }),
      'EVENT_DATE_RANGE_INVALID',
    ],
    [
      'event already ended',
      makeSnapshot({
        event: {
          startsAt: new Date('2028-01-01T18:00:00.000Z'),
          endsAt: new Date('2028-01-01T22:00:00.000Z'),
        },
      }),
      'EVENT_ALREADY_ENDED',
    ],
    [
      'missing venue',
      makeSnapshot({ event: { venueId: null }, venue: null }),
      'EVENT_VENUE_REQUIRED',
    ],
    [
      'invalid venue organization',
      makeSnapshot({ venue: { id: 'venue-1', organizationId: 'org-other' } }),
      'EVENT_VENUE_INVALID',
    ],
    [
      'missing online configuration',
      makeSnapshot({
        event: { format: 'ONLINE', venueId: null, onlineConfigured: false },
        venue: null,
      }),
      'EVENT_ONLINE_CONFIGURATION_REQUIRED',
    ],
    ['missing currency', makeSnapshot({ event: { currency: null } }), 'EVENT_CURRENCY_REQUIRED'],
    [
      'unsupported currency',
      makeSnapshot({ event: { currency: 'USD' } }),
      'EVENT_CURRENCY_UNSUPPORTED',
    ],
    [
      'no active ticket type',
      makeSnapshot({
        ticketTypes: [
          {
            id: 'ticket-1',
            name: 'General',
            priceAmount: 5000,
            capacity: 100,
            status: 'INACTIVE',
          },
        ],
      }),
      'TICKET_TYPE_ACTIVE_REQUIRED',
    ],
    [
      'invalid ticket name',
      makeSnapshot({
        ticketTypes: [
          {
            id: 'ticket-1',
            name: '   ',
            priceAmount: 5000,
            capacity: 100,
            status: 'ACTIVE',
          },
        ],
      }),
      'TICKET_TYPE_NAME_INVALID',
    ],
    [
      'invalid ticket price',
      makeSnapshot({
        ticketTypes: [
          {
            id: 'ticket-1',
            name: 'General',
            priceAmount: -1,
            capacity: 100,
            status: 'ACTIVE',
          },
        ],
      }),
      'TICKET_TYPE_PRICE_INVALID',
    ],
    [
      'invalid ticket capacity',
      makeSnapshot({
        ticketTypes: [
          {
            id: 'ticket-1',
            name: 'General',
            priceAmount: 5000,
            capacity: 0,
            status: 'ACTIVE',
          },
        ],
      }),
      'TICKET_TYPE_CAPACITY_INVALID',
    ],
  ])('returns only the expected issue for %s', (_name, snapshot, expectedCode) => {
    const result = policy.evaluate(snapshot, NOW);

    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([expectedCode]);
  });

  it.each([
    makeSnapshot(),
    makeSnapshot({
      event: { format: 'ONLINE', venueId: null, onlineConfigured: true },
      venue: null,
    }),
    makeSnapshot({ event: { format: 'HYBRID', onlineConfigured: true } }),
  ])('accepts each supported event format when its requirements are satisfied', (snapshot) => {
    expect(policy.evaluate(snapshot, NOW).ready).toBe(true);
  });

  it('returns multiple issues in the stable code order', () => {
    const result = policy.evaluate(
      makeSnapshot({
        organizationStatus: 'SUSPENDED',
        event: {
          title: ' ',
          format: null,
          startsAt: null,
          endsAt: null,
          timezone: null,
          venueId: null,
          currency: null,
        },
        venue: null,
        ticketTypes: [],
      }),
      NOW,
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'ORGANIZATION_NOT_ACTIVE',
      'EVENT_TITLE_REQUIRED',
      'EVENT_FORMAT_REQUIRED',
      'EVENT_STARTS_AT_REQUIRED',
      'EVENT_ENDS_AT_REQUIRED',
      'EVENT_TIMEZONE_REQUIRED',
      'EVENT_CURRENCY_REQUIRED',
      'TICKET_TYPE_ACTIVE_REQUIRED',
    ]);
  });

  it('orders repeated ticket issues by ticket type id', () => {
    const result = policy.evaluate(
      makeSnapshot({
        ticketTypes: [
          {
            id: 'ticket-z',
            name: '',
            priceAmount: 100,
            capacity: 1,
            status: 'ACTIVE',
          },
          {
            id: 'ticket-a',
            name: '',
            priceAmount: 100,
            capacity: 1,
            status: 'ACTIVE',
          },
        ],
      }),
      NOW,
    );

    expect(result.issues.map((issue) => issue.field)).toEqual([
      'ticketTypes.ticket-a.name',
      'ticketTypes.ticket-z.name',
    ]);
  });
});
