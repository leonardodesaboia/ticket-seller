import { Inject, Injectable } from '@nestjs/common';
import type { Event } from '../../domain/event.entity';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVenueNotFoundError,
  EventVenueOrganizationMismatchError,
  EventVersionConflictError,
  InsufficientRoleError,
  InvalidDateRangeError,
  InvalidOnlineConfigurationUpdateError,
  InvalidTimezoneError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import { EVENT_REPOSITORY, type IEventRepository } from '../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';
import { VENUE_ACCESS_PORT, type IVenueAccessPort } from '../ports/venue-access.port';

export interface UpdateEventConfigurationCommand {
  organizationId: string;
  eventId: string;
  actorId: string;
  expectedVersion: number;
  format?: string;
  startsAt?: Date;
  endsAt?: Date;
  timezone?: string;
  onlineInfo?: string | null;
  clearOnlineInfo?: boolean;
  venueId?: string | null;
  currency?: string;
}

function isValidIANATimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class UpdateEventConfigurationUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
    @Inject(VENUE_ACCESS_PORT) private readonly venueAccess: IVenueAccessPort,
  ) {}

  async execute(command: UpdateEventConfigurationCommand): Promise<Event> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    const event = await this.eventRepository.findByOrganizationAndId(
      command.organizationId,
      command.eventId,
    );

    if (!event) {
      throw new EventNotFoundError();
    }

    if (event.status !== 'DRAFT') {
      throw new EventNotInDraftError();
    }

    if (event.version !== command.expectedVersion) {
      throw new EventVersionConflictError();
    }

    const onlineInfo = command.onlineInfo;
    const hasOnlineInfo = onlineInfo !== undefined;
    if (
      (hasOnlineInfo &&
        (onlineInfo === null ||
          onlineInfo.trim().length === 0 ||
          onlineInfo.length > 2000)) ||
      (hasOnlineInfo && command.clearOnlineInfo === true)
    ) {
      throw new InvalidOnlineConfigurationUpdateError();
    }

    if (command.timezone !== undefined && !isValidIANATimezone(command.timezone)) {
      throw new InvalidTimezoneError(command.timezone);
    }

    const effectiveStartsAt = command.startsAt ?? event.startsAt;
    const effectiveEndsAt = command.endsAt ?? event.endsAt;
    if (effectiveStartsAt && effectiveEndsAt && effectiveEndsAt <= effectiveStartsAt) {
      throw new InvalidDateRangeError();
    }

    if (command.venueId !== undefined && command.venueId !== null) {
      const venue = await this.venueAccess.findVenue(command.venueId);
      if (!venue) {
        throw new EventVenueNotFoundError(command.venueId);
      }
      if (venue.organizationId !== command.organizationId) {
        throw new EventVenueOrganizationMismatchError();
      }
    }

    return this.eventRepository.updateConfiguration({
      organizationId: command.organizationId,
      eventId: command.eventId,
      expectedVersion: command.expectedVersion,
      ...(command.format !== undefined && { format: command.format }),
      ...(command.startsAt !== undefined && { startsAt: command.startsAt }),
      ...(command.endsAt !== undefined && { endsAt: command.endsAt }),
      ...(command.timezone !== undefined && { timezone: command.timezone }),
      ...(command.onlineInfo !== undefined && { onlineInfo: command.onlineInfo }),
      ...(command.clearOnlineInfo === true && { onlineInfo: null }),
      ...(command.venueId !== undefined && { venueId: command.venueId }),
      ...(command.currency !== undefined && { currency: command.currency }),
    });
  }
}
