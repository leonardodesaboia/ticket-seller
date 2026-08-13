import { Allow, IsNotEmpty, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  eventSlug!: string;

  @Allow()
  items!: unknown;
}
