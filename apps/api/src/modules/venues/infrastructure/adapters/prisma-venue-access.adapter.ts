import { Injectable } from '@nestjs/common';
import { IVenueAccessPort, VenueInfo } from '../../../events/domain/ports/venue-access.port';
import { PrismaService } from '../../../../platform/database/prisma.service';

@Injectable()
export class PrismaVenueAccessAdapter implements IVenueAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async findVenue(venueId: string): Promise<VenueInfo | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, organizationId: true },
    });
    if (!venue) return null;
    return { id: venue.id, organizationId: venue.organizationId };
  }
}
