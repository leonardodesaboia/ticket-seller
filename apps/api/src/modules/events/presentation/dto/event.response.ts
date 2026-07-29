import { ApiProperty } from '@nestjs/swagger';
import type { Event } from '../../domain/event.entity';

export class EventResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(event: Event): EventResponse {
    const res = new EventResponse();
    res.id = event.id;
    res.organizationId = event.organizationId;
    res.title = event.title;
    res.description = event.description;
    res.status = event.status;
    res.createdAt = event.createdAt.toISOString();
    res.updatedAt = event.updatedAt.toISOString();
    return res;
  }
}
