import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderPublicRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CancelOrderAdminRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
