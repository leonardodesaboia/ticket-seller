import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Rock Festival 2026', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'Annual rock music festival' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;
}
