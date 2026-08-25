import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { OrganizationRoleGuard } from '../../../../platform/http/guards/organization-role.guard';
import { RequireCapability } from '../../../../platform/http/decorators/require-capability.decorator';
import { OrganizationCapability } from '../../../../shared/kernel/organization-capability';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { GenerateEventCoverUploadUrlUseCase } from '../../application/use-cases/generate-event-cover-upload-url.use-case';
import { ConfirmEventCoverUploadUseCase } from '../../application/use-cases/confirm-event-cover-upload.use-case';
import { GetEventCoverUrlUseCase } from '../../application/use-cases/get-event-cover-url.use-case';
import { GenerateUploadUrlDto } from '../dtos/generate-upload-url.dto';
import { ConfirmUploadDto } from '../dtos/confirm-upload.dto';

@ApiTags('media')
@Controller('organizations/:orgId/events/:eventId/cover')
export class EventCoverController {
  constructor(
    private readonly generateUploadUrl: GenerateEventCoverUploadUrlUseCase,
    private readonly confirmUpload: ConfirmEventCoverUploadUseCase,
    private readonly getCoverUrl: GetEventCoverUrlUseCase,
  ) {}

  @Post('upload-url')
  @UseGuards(ActorGuard, OrganizationRoleGuard)
  @RequireCapability(OrganizationCapability.EVENTS_MANAGE)
  @HttpCode(200)
  async generateUploadUrlEndpoint(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @CurrentActor() actor: ICurrentActor,
    @Body() dto: GenerateUploadUrlDto,
  ) {
    return this.generateUploadUrl.execute({
      organizationId: orgId,
      eventId,
      uploaderId: actor.userId,
      contentType: dto.contentType,
    });
  }

  @Post('confirm')
  @UseGuards(ActorGuard, OrganizationRoleGuard)
  @RequireCapability(OrganizationCapability.EVENTS_MANAGE)
  @HttpCode(200)
  async confirmUploadEndpoint(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.confirmUpload.execute({
      organizationId: orgId,
      eventId,
      key: dto.key,
    });
  }

  @Get()
  @UseGuards(ActorGuard, OrganizationRoleGuard)
  @RequireCapability(OrganizationCapability.EVENTS_MANAGE)
  async getCover(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
  ) {
    return this.getCoverUrl.execute({ organizationId: orgId, eventId });
  }
}
