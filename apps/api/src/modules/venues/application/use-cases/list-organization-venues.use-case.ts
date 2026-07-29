import { Inject, Injectable } from '@nestjs/common';
import type { Venue } from '../../domain/venue.entity';
import { IVenueRepository, VENUE_REPOSITORY } from '../../domain/ports/venue-repository.port';
import {
  IOrganizationAccessPort,
  ORGANIZATION_ACCESS_PORT,
} from '../../../events/domain/ports/organization-access.port';
import { OrganizationAccessDeniedError } from '../../../events/domain/event.errors';

export interface ListOrganizationVenuesCommand {
  organizationId: string;
  actorId: string;
}

@Injectable()
export class ListOrganizationVenuesUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly venueRepository: IVenueRepository,
    @Inject(ORGANIZATION_ACCESS_PORT) private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: ListOrganizationVenuesCommand): Promise<Venue[]> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    return this.venueRepository.findByOrganization(command.organizationId);
  }
}
