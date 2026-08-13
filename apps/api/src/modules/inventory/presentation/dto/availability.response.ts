import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityItemResponse {
  @ApiProperty() ticketTypeId!: string;
  @ApiProperty() availableQuantity!: number;
}

export class AvailabilityResponse {
  @ApiProperty() eventSlug!: string;
  @ApiProperty({ type: [AvailabilityItemResponse] }) items!: AvailabilityItemResponse[];
}
