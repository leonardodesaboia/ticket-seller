import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListPublicEventsUseCase } from '../../application/use-cases/list-public-events.use-case';
import { GetPublicEventUseCase } from '../../application/use-cases/get-public-event.use-case';
import {
  InvalidCursorError,
  PublicEventNotFoundError,
} from '../../application/errors/public-catalog.errors';
import { PublicEventDetailResponse, PublicEventListResponse } from '../dto/public-event.response';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

@ApiTags('public-events')
@Controller('public/events')
export class PublicEventsController {
  constructor(
    private readonly listPublicEvents: ListPublicEventsUseCase,
    private readonly getPublicEvent: GetPublicEventUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', CACHE_CONTROL)
  async list(
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limitStr: string | undefined,
  ): Promise<PublicEventListResponse> {
    // Clamp to [1, MAX_LIMIT], mirroring the admin listing convention
    // (events.controller). A malformed limit falls back to the default rather
    // than erroring, keeping this cacheable public endpoint forgiving.
    const limit = limitStr
      ? Math.min(Math.max(parseInt(limitStr, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    try {
      const result = await this.listPublicEvents.execute({
        limit,
        ...(cursor !== undefined && { cursor }),
      });
      return PublicEventListResponse.from(result);
    } catch (error) {
      if (error instanceof InvalidCursorError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Get(':slug')
  @Header('Cache-Control', CACHE_CONTROL)
  async detail(@Param('slug') slug: string): Promise<PublicEventDetailResponse> {
    try {
      const detail = await this.getPublicEvent.execute(slug);
      return PublicEventDetailResponse.from(detail);
    } catch (error) {
      if (error instanceof PublicEventNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
