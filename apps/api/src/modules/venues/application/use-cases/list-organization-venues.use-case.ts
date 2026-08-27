import type { Venue } from '../../domain/venue.entity';
import { IVenueRepository } from '../../domain/ports/venue-repository.port';
import {
  IOrganizationAccessPort,
} from '../../../organizations/contracts/organization-access.contract';
import { OrganizationAccessDeniedError } from '../../../organizations/contracts/organization-access.errors';

export interface ListOrganizationVenuesCommand {
  organizationId: string;
  actorId: string;
}

export class ListOrganizationVenuesUseCase {
  constructor(
    private readonly venueRepository: IVenueRepository,
    private readonly orgAccess: IOrganizationAccessPort,
  ) {}

  async execute(command: ListOrganizationVenuesCommand): Promise<Venue[]> {
    const member = await this.orgAccess.findMember(command.organizationId, command.actorId);

    if (!member || member.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError();
    }

    return this.venueRepository.findByOrganization(command.organizationId);
  }
}
