import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Venue } from '../../domain/venue.entity';
import { IVenueRepository, VENUE_REPOSITORY } from '../../domain/ports/venue-repository.port';
import {
  EVENT_CREATOR_ROLES,
  IOrganizationAccessPort,
  ORGANIZATION_ACCESS_PORT,
} from '../../../events/domain/ports/organization-access.port';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../../events/domain/event.errors';

export interface CreateVenueCommand {
  organizationId: string;
  actorId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

@Injectable()
export class CreateVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly venueRepository: IVenueRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: CreateVenueCommand): Promise<Venue> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    if (!(EVENT_CREATOR_ROLES as readonly string[]).includes(member.role)) {
      throw new InsufficientRoleError();
    }

    return this.venueRepository.create({
      id: randomUUID(),
      organizationId: command.organizationId,
      name: command.name,
      address: command.address,
      city: command.city,
      state: command.state,
      country: command.country,
      ...(command.postalCode !== undefined && { postalCode: command.postalCode }),
    });
  }
}
