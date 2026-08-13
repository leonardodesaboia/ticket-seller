import { ApiProperty } from '@nestjs/swagger';
import type { Event } from '../../domain/event.entity';

export class EventResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true }) format!: string | null;
  @ApiProperty({ nullable: true }) startsAt!: string | null;
  @ApiProperty({ nullable: true }) endsAt!: string | null;
  @ApiProperty({ nullable: true }) timezone!: string | null;
  @ApiProperty({ nullable: true }) venueId!: string | null;
  @ApiProperty({ nullable: true }) currency!: string | null;
  @ApiProperty() onlineConfigured!: boolean;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(event: Event): EventResponse {
    const res = new EventResponse();
    res.id = event.id;
    res.organizationId = event.organizationId;
    res.title = event.title;
    res.description = event.description;
    res.status = event.status;
    res.version = event.version;
    res.format = event.format;
    res.startsAt = event.startsAt ? event.startsAt.toISOString() : null;
    res.endsAt = event.endsAt ? event.endsAt.toISOString() : null;
    res.timezone = event.timezone;
    res.venueId = event.venueId;
    res.currency = event.currency;
    res.onlineConfigured = event.onlineInfo !== null && event.onlineInfo.trim().length > 0;
    res.slug = event.slug;
    res.publishedAt = event.publishedAt ? event.publishedAt.toISOString() : null;
    res.createdAt = event.createdAt.toISOString();
    res.updatedAt = event.updatedAt.toISOString();
    return res;
  }
}
