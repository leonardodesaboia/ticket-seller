import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetAvailabilityUseCase } from '../../application/use-cases/get-availability.use-case';
import { AvailabilityResponse } from '../dto/availability.response';

const CACHE_CONTROL = 'public, max-age=10, stale-while-revalidate=30';

@ApiTags('public-inventory')
@Controller('public/events')
export class PublicAvailabilityController {
  constructor(private readonly getAvailability: GetAvailabilityUseCase) {}

  @Get(':slug/availability')
  @Header('Cache-Control', CACHE_CONTROL)
  async getEventAvailability(@Param('slug') slug: string): Promise<AvailabilityResponse> {
    const result = await this.getAvailability.execute({ eventSlug: slug });
    if (!result) {
      throw new NotFoundException('Event not found or not published');
    }
    const response = new AvailabilityResponse();
    response.eventSlug = result.eventSlug;
    response.items = result.items.map((item) => ({
      ticketTypeId: item.ticketTypeId,
      availableQuantity: item.availableQuantity,
    }));
    return response;
  }
}
