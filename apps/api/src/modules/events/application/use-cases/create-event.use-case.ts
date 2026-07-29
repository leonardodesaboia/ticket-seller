import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Event } from '../../domain/event.entity';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../domain/event.errors';
import { EVENT_REPOSITORY, type IEventRepository } from '../../domain/ports/event-repository.port';
import {
  EVENT_CREATOR_ROLES,
  ORGANIZATION_ACCESS_PORT,
  type IOrganizationAccessPort,
} from '../../domain/ports/organization-access.port';

export interface CreateEventCommand {
  organizationId: string;
  title: string;
  description: string | null;
  actorId: string;
}

@Injectable()
export class CreateEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepository: IEventRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: CreateEventCommand): Promise<Event> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    return this.eventRepository.create({
      id: randomUUID(),
      organizationId: command.organizationId,
      title: command.title,
      description: command.description,
    });
  }
}
