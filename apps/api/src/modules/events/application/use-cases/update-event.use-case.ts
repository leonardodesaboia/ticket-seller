import { Inject, Injectable } from '@nestjs/common';
import type { Event } from '../../domain/event.entity';
import {
  EventNotFoundError,
  EventNotInDraftError,
  EventVersionConflictError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import { EVENT_REPOSITORY, type IEventRepository } from '../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface UpdateEventCommand {
  organizationId: string;
  eventId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  version: number;
}

@Injectable()
export class UpdateEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: UpdateEventCommand): Promise<Event> {
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

    if (event.version !== command.version) {
      throw new EventVersionConflictError();
    }

    return this.eventRepository.update({
      organizationId: command.organizationId,
      eventId: command.eventId,
      expectedVersion: command.version,
      ...(command.title !== undefined && { title: command.title }),
      ...(command.description !== undefined && { description: command.description }),
    });
  }
}
