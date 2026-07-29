import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsInt()
  @Min(0)
  priceAmount!: number;

  @IsInt()
  @Min(1)
  capacity!: number;
}
