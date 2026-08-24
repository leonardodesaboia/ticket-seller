import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiPropertyOptional({ description: 'User ID to associate with the invitation' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
