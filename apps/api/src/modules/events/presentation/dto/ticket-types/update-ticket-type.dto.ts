import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';

const TICKET_TYPE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class UpdateTicketTypeDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(TICKET_TYPE_STATUSES)
  status?: string;
}
