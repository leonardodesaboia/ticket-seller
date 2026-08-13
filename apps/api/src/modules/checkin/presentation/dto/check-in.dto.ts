import { IsHexadecimal, Length, IsOptional, IsString, MaxLength } from 'class-validator';
import { CheckInResult } from '../../domain/check-in.entity';

export class PerformCheckInBodyDto {
  @IsHexadecimal()
  @Length(64, 64)
  credential!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CheckInResponseDto {
  decision!: CheckInResult;
  allowed!: boolean;
  checkedInAt!: string | null;
}
