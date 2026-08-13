import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PublishEventDto {
  @ApiProperty({ example: 4, minimum: 1, description: 'Expected current event version' })
  @IsInt()
  @Min(1)
  version!: number;
}
