export const PUBLICATION_ISSUE_CODES = [
  'ORGANIZATION_NOT_ACTIVE',
  'EVENT_NOT_DRAFT',
  'EVENT_TITLE_REQUIRED',
  'EVENT_FORMAT_REQUIRED',
  'EVENT_FORMAT_INVALID',
  'EVENT_STARTS_AT_REQUIRED',
  'EVENT_ENDS_AT_REQUIRED',
  'EVENT_TIMEZONE_REQUIRED',
  'EVENT_TIMEZONE_INVALID',
  'EVENT_DATE_RANGE_INVALID',
  'EVENT_ALREADY_ENDED',
  'EVENT_VENUE_REQUIRED',
  'EVENT_VENUE_INVALID',
  'EVENT_ONLINE_CONFIGURATION_REQUIRED',
  'EVENT_CURRENCY_REQUIRED',
  'EVENT_CURRENCY_UNSUPPORTED',
  'TICKET_TYPE_ACTIVE_REQUIRED',
  'TICKET_TYPE_NAME_INVALID',
  'TICKET_TYPE_PRICE_INVALID',
  'TICKET_TYPE_CAPACITY_INVALID',
  'EVENT_STARTS_AT_IN_PAST',
] as const;

export type PublicationIssueCode = (typeof PUBLICATION_ISSUE_CODES)[number];

export interface PublicationReadinessIssue {
  code: PublicationIssueCode;
  field: string;
  section: string;
  message: string;
}

export interface PublicationReadiness {
  ready: boolean;
  version: number;
  issues: PublicationReadinessIssue[];
}

export interface PublicationReadinessSnapshot {
  organizationStatus: string;
  event: {
    id: string;
    organizationId: string;
    title: string;
    status: string;
    version: number;
    format: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    timezone: string | null;
    onlineConfigured: boolean;
    venueId: string | null;
    currency: string | null;
  };
  venue: {
    id: string;
    organizationId: string;
  } | null;
  ticketTypes: Array<{
    id: string;
    name: string;
    priceAmount: number;
    capacity: number;
    status: string;
  }>;
}

const VALID_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function issue(
  code: PublicationIssueCode,
  field: string,
  section: string,
  message: string,
): PublicationReadinessIssue {
  return { code, field, section, message };
}

export class PublicationReadinessPolicy {
  evaluate(snapshot: PublicationReadinessSnapshot, now: Date): PublicationReadiness {
    const issues: PublicationReadinessIssue[] = [];
    const { event } = snapshot;

    if (snapshot.organizationStatus !== 'ACTIVE') {
      issues.push(
        issue(
          'ORGANIZATION_NOT_ACTIVE',
          'organization.status',
          'organization',
          'A organização deve estar ativa.',
        ),
      );
    }
    if (event.status !== 'DRAFT') {
      issues.push(
        issue('EVENT_NOT_DRAFT', 'status', 'basic', 'Somente eventos em rascunho podem ser publicados.'),
      );
    }
    if (event.title.trim().length === 0) {
      issues.push(issue('EVENT_TITLE_REQUIRED', 'title', 'basic', 'Defina o título do evento.'));
    }

    const formatIsSupported = (VALID_FORMATS as readonly string[]).includes(event.format ?? '');
    if (event.format === null) {
      issues.push(issue('EVENT_FORMAT_REQUIRED', 'format', 'format', 'Defina o formato do evento.'));
    } else if (!formatIsSupported) {
      issues.push(issue('EVENT_FORMAT_INVALID', 'format', 'format', 'Defina um formato válido.'));
    }

    if (event.startsAt === null) {
      issues.push(
        issue(
          'EVENT_STARTS_AT_REQUIRED',
          'startsAt',
          'schedule',
          'Defina a data e o horário de início.',
        ),
      );
    } else if (event.startsAt.getTime() <= now.getTime()) {
      // Only flag when endsAt is still in the future — if the event has
      // already ended, EVENT_ALREADY_ENDED is the dominant signal.
      const endsAtInFuture = event.endsAt === null || event.endsAt.getTime() > now.getTime();
      if (endsAtInFuture) {
        issues.push(
          issue(
            'EVENT_STARTS_AT_IN_PAST',
            'startsAt',
            'schedule',
            'O início do evento deve ser no futuro.',
          ),
        );
      }
    }
    if (event.endsAt === null) {
      issues.push(
        issue(
          'EVENT_ENDS_AT_REQUIRED',
          'endsAt',
          'schedule',
          'Defina a data e o horário de término.',
        ),
      );
    }
    if (event.timezone === null) {
      issues.push(
        issue('EVENT_TIMEZONE_REQUIRED', 'timezone', 'schedule', 'Defina o fuso horário.'),
      );
    } else if (!isValidTimezone(event.timezone)) {
      issues.push(
        issue('EVENT_TIMEZONE_INVALID', 'timezone', 'schedule', 'Defina um fuso horário válido.'),
      );
    }
    if (
      event.startsAt !== null &&
      event.endsAt !== null &&
      event.endsAt.getTime() <= event.startsAt.getTime()
    ) {
      issues.push(
        issue(
          'EVENT_DATE_RANGE_INVALID',
          'endsAt',
          'schedule',
          'O término deve ser posterior ao início.',
        ),
      );
    }
    if (event.endsAt !== null && event.endsAt.getTime() <= now.getTime()) {
      issues.push(
        issue(
          'EVENT_ALREADY_ENDED',
          'endsAt',
          'schedule',
          'O evento deve terminar no futuro.',
        ),
      );
    }

    const requiresVenue = event.format === 'IN_PERSON' || event.format === 'HYBRID';
    if (requiresVenue && event.venueId === null) {
      issues.push(issue('EVENT_VENUE_REQUIRED', 'venueId', 'venue', 'Selecione um local.'));
    } else if (
      requiresVenue &&
      (snapshot.venue === null ||
        snapshot.venue.id !== event.venueId ||
        snapshot.venue.organizationId !== event.organizationId)
    ) {
      issues.push(
        issue(
          'EVENT_VENUE_INVALID',
          'venueId',
          'venue',
          'Selecione um local válido da organização.',
        ),
      );
    }

    const requiresOnlineConfiguration =
      event.format === 'ONLINE' || event.format === 'HYBRID';
    if (requiresOnlineConfiguration && !event.onlineConfigured) {
      issues.push(
        issue(
          'EVENT_ONLINE_CONFIGURATION_REQUIRED',
          'onlineConfigured',
          'online',
          'Configure as informações privadas de acesso online.',
        ),
      );
    }

    if (event.currency === null) {
      issues.push(issue('EVENT_CURRENCY_REQUIRED', 'currency', 'currency', 'Defina a moeda.'));
    } else if (event.currency !== 'BRL') {
      issues.push(
        issue(
          'EVENT_CURRENCY_UNSUPPORTED',
          'currency',
          'currency',
          'A moeda deve ser BRL nesta fase.',
        ),
      );
    }

    const activeTicketTypes = snapshot.ticketTypes
      .filter((ticketType) => ticketType.status === 'ACTIVE')
      .sort((left, right) => left.id.localeCompare(right.id));
    if (activeTicketTypes.length === 0) {
      issues.push(
        issue(
          'TICKET_TYPE_ACTIVE_REQUIRED',
          'ticketTypes',
          'ticketTypes',
          'Crie ao menos um tipo de ingresso ativo.',
        ),
      );
    }
    for (const ticketType of activeTicketTypes) {
      if (ticketType.name.trim().length === 0) {
        issues.push(
          issue(
            'TICKET_TYPE_NAME_INVALID',
            `ticketTypes.${ticketType.id}.name`,
            'ticketTypes',
            'Defina um nome válido para o tipo de ingresso.',
          ),
        );
      }
    }
    for (const ticketType of activeTicketTypes) {
      if (!Number.isInteger(ticketType.priceAmount) || ticketType.priceAmount < 0) {
        issues.push(
          issue(
            'TICKET_TYPE_PRICE_INVALID',
            `ticketTypes.${ticketType.id}.priceAmount`,
            'ticketTypes',
            'Defina um preço não negativo.',
          ),
        );
      }
    }
    for (const ticketType of activeTicketTypes) {
      if (!Number.isInteger(ticketType.capacity) || ticketType.capacity <= 0) {
        issues.push(
          issue(
            'TICKET_TYPE_CAPACITY_INVALID',
            `ticketTypes.${ticketType.id}.capacity`,
            'ticketTypes',
            'Defina uma capacidade positiva.',
          ),
        );
      }
    }

    return {
      ready: issues.length === 0,
      version: event.version,
      issues,
    };
  }
}
