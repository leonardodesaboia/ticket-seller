import { Module } from '@nestjs/common';
import { HttpModule } from '../../platform/http/http.module';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { ORGANIZATION_REPOSITORY } from './domain/ports/organization-repository.port';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-organization.repository';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  imports: [HttpModule],
  controllers: [OrganizationsController],
  providers: [
    CreateOrganizationUseCase,
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
  ],
})
export class OrganizationsModule {}
