import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IVenueRepository, CreateVenueInput } from '../../domain/ports/venue-repository.port';
import { Venue } from '../../domain/venue.entity';
import type { Venue as PrismaVenue } from '@prisma/client';

@Injectable()
export class PrismaVenueRepository implements IVenueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateVenueInput): Promise<Venue> {
    const venue = await this.prisma.venue.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
      },
    });
    return this.toEntity(venue);
  }

  async findByOrganization(organizationId: string): Promise<Venue[]> {
    const venues = await this.prisma.venue.findMany({
      where: { organizationId },
      orderBy: [{ name: 'asc' }],
    });
    return venues.map((v) => this.toEntity(v));
  }

  private toEntity(venue: PrismaVenue): Venue {
    return new Venue(
      venue.id,
      venue.organizationId,
      venue.name,
      venue.address,
      venue.city,
      venue.state,
      venue.country,
      venue.postalCode,
      venue.createdAt,
      venue.updatedAt,
    );
  }
}
