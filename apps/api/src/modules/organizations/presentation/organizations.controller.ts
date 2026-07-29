import { Body, ConflictException, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import { CreateOrganizationUseCase } from '../application/use-cases/create-organization.use-case';
import { SlugAlreadyInUseError } from '../domain/organization.errors';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationResponse } from './dto/organization.response';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(ActorGuard)
export class OrganizationsController {
  constructor(private readonly createOrganization: CreateOrganizationUseCase) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: OrganizationResponse })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<OrganizationResponse> {
    try {
      const org = await this.createOrganization.execute({
        name: dto.name,
        slug: dto.slug,
        actorId: actor.userId,
      });
      return OrganizationResponse.from(org);
    } catch (err) {
      if (err instanceof SlugAlreadyInUseError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }
}
