import { ApiProperty } from '@nestjs/swagger';
import type {
  PublicEventDetail,
  PublicEventListResult,
} from '../../application/ports/public-event-query.port';

export class PublicEventListItemResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) format!: string | null;
  @ApiProperty({ nullable: true }) startsAt!: string | null;
  @ApiProperty({ nullable: true }) endsAt!: string | null;
  @ApiProperty({ nullable: true }) timezone!: string | null;
  @ApiProperty({ nullable: true }) currency!: string | null;
}

export class PublicEventListResponse {
  @ApiProperty({ type: [PublicEventListItemResponse] }) data!: PublicEventListItemResponse[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;

  static from(result: PublicEventListResult): PublicEventListResponse {
    const response = new PublicEventListResponse();
    response.data = result.events.map((event) => ({
      slug: event.slug,
      title: event.title,
      format: event.format,
      startsAt: event.startsAt ? event.startsAt.toISOString() : null,
      endsAt: event.endsAt ? event.endsAt.toISOString() : null,
      timezone: event.timezone,
      currency: event.currency,
    }));
    response.nextCursor = result.nextCursor;
    return response;
  }
}

export class PublicVenueResponse {
  @ApiProperty() name!: string;
  @ApiProperty() city!: string;
  @ApiProperty() state!: string;
  @ApiProperty() country!: string;
}

export class PublicTicketTypeResponse {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() price!: number;
  @ApiProperty({ nullable: true }) currency!: string | null;
}

export class PublicEventDetailResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ nullable: true }) format!: string | null;
  @ApiProperty({ nullable: true }) startsAt!: string | null;
  @ApiProperty({ nullable: true }) endsAt!: string | null;
  @ApiProperty({ nullable: true }) timezone!: string | null;
  @ApiProperty({ nullable: true }) currency!: string | null;
  @ApiProperty({ type: PublicVenueResponse, nullable: true }) venue!: PublicVenueResponse | null;
  @ApiProperty({ type: [PublicTicketTypeResponse] }) ticketTypes!: PublicTicketTypeResponse[];

  static from(detail: PublicEventDetail): PublicEventDetailResponse {
    const response = new PublicEventDetailResponse();
    response.slug = detail.slug;
    response.title = detail.title;
    response.description = detail.description;
    response.format = detail.format;
    response.startsAt = detail.startsAt ? detail.startsAt.toISOString() : null;
    response.endsAt = detail.endsAt ? detail.endsAt.toISOString() : null;
    response.timezone = detail.timezone;
    response.currency = detail.currency;
    response.venue = detail.venue;
    response.ticketTypes = detail.ticketTypes.map((ticketType) => ({
      name: ticketType.name,
      description: ticketType.description,
      price: ticketType.priceAmount,
      currency: ticketType.currency,
    }));
    return response;
  }
}
