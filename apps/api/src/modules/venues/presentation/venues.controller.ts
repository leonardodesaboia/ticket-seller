import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import { CreateVenueUseCase } from '../application/use-cases/create-venue.use-case';
import { ListOrganizationVenuesUseCase } from '../application/use-cases/list-organization-venues.use-case';
import { InsufficientRoleError, OrganizationAccessDeniedError } from '../../events/domain/event.errors';
import { CreateVenueDto } from './dto/create-venue.dto';
import { VenueResponse } from './dto/venue.response';

const uuidPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('venues')
@Controller('organizations/:organizationId/venues')
@UseGuards(ActorGuard)
export class VenuesController {
  constructor(
    private readonly createVenueUseCase: CreateVenueUseCase,
    private readonly listVenuesUseCase: ListOrganizationVenuesUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('organizationId', uuidPipe) organizationId: string,
    @Body() dto: CreateVenueDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<VenueResponse> {
    try {
      const venue = await this.createVenueUseCase.execute({
        organizationId,
        actorId: actor.userId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
      });
      return VenueResponse.from(venue);
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      throw err;
    }
  }

  @Get()
  async list(
    @Param('organizationId', uuidPipe) organizationId: string,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<{ data: VenueResponse[] }> {
    try {
      const venues = await this.listVenuesUseCase.execute({
        organizationId,
        actorId: actor.userId,
      });
      return { data: venues.map((v) => VenueResponse.from(v)) };
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      throw err;
    }
  }
}
