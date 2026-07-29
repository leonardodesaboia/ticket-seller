import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { GetPublicationReadinessUseCase } from '../../application/use-cases/get-publication-readiness.use-case';
import {
  EventNotFoundError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import { PublicationReadinessResponse } from '../dto/publication-readiness.response';

@ApiTags('event-publication')
@Controller('organizations/:organizationId/events/:eventId/publication-readiness')
@UseGuards(ActorGuard)
export class PublicationReadinessController {
  constructor(private readonly getReadiness: GetPublicationReadinessUseCase) {}

  @Get()
  async get(
    @Param('organizationId', new ParseUUIDPipe({ version: '4' })) organizationId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<PublicationReadinessResponse> {
    try {
      const readiness = await this.getReadiness.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
      });
      return PublicationReadinessResponse.from(readiness);
    } catch (error) {
      if (error instanceof OrganizationAccessDeniedError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof EventNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof InsufficientRoleError) throw new ForbiddenException(error.message);
      throw error;
    }
  }
}
