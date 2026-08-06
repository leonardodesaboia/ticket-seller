import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { PublishEventUseCase } from '../../application/use-cases/publish-event.use-case';
import type { PublishedEventData } from '../../application/ports/publish-event-operation.port';
import { IdempotencyKeyConflictError } from '../../application/errors/idempotency-key-conflict.error';
import {
  EventNotDraftError,
  EventNotFoundError,
  EventPublicationNotReadyError,
  EventVersionConflictError,
  InsufficientRoleError,
  OrganizationAccessDeniedError,
} from '../../domain/event.errors';
import { PublishEventDto } from '../dto/publish-event.dto';
import { EventResponse } from '../dto/event.response';

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

@ApiTags('event-publication')
@Controller('organizations/:organizationId/events/:eventId/publish')
@UseGuards(ActorGuard)
export class PublishEventController {
  constructor(private readonly publishEvent: PublishEventUseCase) {}

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: EventResponse })
  async publish(
    @Param('organizationId', new ParseUUIDPipe({ version: '4' })) organizationId: string,
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: PublishEventDto,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<PublishedEventData> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (
      !normalizedIdempotencyKey ||
      normalizedIdempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
      hasControlCharacters(normalizedIdempotencyKey)
    ) {
      throw new UnprocessableEntityException(
        'Idempotency-Key must contain 1 to 255 printable characters',
      );
    }
    try {
      const { event } = await this.publishEvent.execute({
        organizationId,
        eventId,
        actorId: actor.userId,
        idempotencyKey: normalizedIdempotencyKey,
        expectedVersion: dto.version,
      });
      return event;
    } catch (err) {
      if (err instanceof OrganizationAccessDeniedError) throw new NotFoundException(err.message);
      if (err instanceof EventNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof InsufficientRoleError) throw new ForbiddenException(err.message);
      if (err instanceof EventNotDraftError) {
        throw new ConflictException({ message: err.message, code: 'EVENT_NOT_DRAFT' });
      }
      if (err instanceof EventVersionConflictError) {
        throw new ConflictException({ message: err.message, code: 'EVENT_VERSION_CONFLICT' });
      }
      if (err instanceof IdempotencyKeyConflictError) {
        throw new ConflictException({ message: err.message, code: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if (err instanceof EventPublicationNotReadyError) {
        throw new UnprocessableEntityException({
          message: err.message,
          code: 'EVENT_PUBLICATION_NOT_READY',
          version: err.version,
          issues: err.issues,
        });
      }
      throw err;
    }
  }
}
