import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateVenueUseCase } from './application/use-cases/create-venue.use-case';
import { ListOrganizationVenuesUseCase } from './application/use-cases/list-organization-venues.use-case';
import { VENUE_REPOSITORY } from './domain/ports/venue-repository.port';
import { ORGANIZATION_ACCESS_PORT } from '../events/domain/ports/organization-access.port';
import { VENUE_ACCESS_PORT } from '../events/domain/ports/venue-access.port';
import { PrismaOrganizationAccessAdapter } from '../events/infrastructure/adapters/prisma-organization-access.adapter';
import { PrismaVenueRepository } from './infrastructure/repositories/prisma-venue.repository';
import { PrismaVenueAccessAdapter } from './infrastructure/adapters/prisma-venue-access.adapter';
import { VenuesController } from './presentation/venues.controller';

@Module({
  imports: [HttpModule],
  controllers: [VenuesController],
  providers: [
    CreateVenueUseCase,
    ListOrganizationVenuesUseCase,
    { provide: VENUE_REPOSITORY, useClass: PrismaVenueRepository },
    { provide: ORGANIZATION_ACCESS_PORT, useClass: PrismaOrganizationAccessAdapter },
    { provide: VENUE_ACCESS_PORT, useClass: PrismaVenueAccessAdapter },
  ],
  exports: [VENUE_ACCESS_PORT],
})
export class VenuesModule {}
