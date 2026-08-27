import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateVenueUseCase } from './application/use-cases/create-venue.use-case';
import { ListOrganizationVenuesUseCase } from './application/use-cases/list-organization-venues.use-case';
import { VENUE_REPOSITORY, IVenueRepository } from './domain/ports/venue-repository.port';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ORGANIZATION_ACCESS_PORT, IOrganizationAccessPort } from '../organizations/contracts/organization-access.contract';
import { VENUE_ACCESS_PORT } from './contracts/venue-access.contract';
import { PrismaVenueRepository } from './infrastructure/repositories/prisma-venue.repository';
import { PrismaVenueAccessAdapter } from './infrastructure/adapters/prisma-venue-access.adapter';
import { VenuesController } from './presentation/venues.controller';

@Module({
  imports: [HttpModule, OrganizationsModule],
  controllers: [VenuesController],
  providers: [
    { provide: VENUE_REPOSITORY, useClass: PrismaVenueRepository },
    { provide: VENUE_ACCESS_PORT, useClass: PrismaVenueAccessAdapter },
    {
      provide: CreateVenueUseCase,
      useFactory: (repo: IVenueRepository, orgAccess: IOrganizationAccessPort) =>
        new CreateVenueUseCase(repo, orgAccess),
      inject: [VENUE_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
    {
      provide: ListOrganizationVenuesUseCase,
      useFactory: (repo: IVenueRepository, orgAccess: IOrganizationAccessPort) =>
        new ListOrganizationVenuesUseCase(repo, orgAccess),
      inject: [VENUE_REPOSITORY, ORGANIZATION_ACCESS_PORT],
    },
  ],
  exports: [VENUE_ACCESS_PORT],
})
export class VenuesModule {}
