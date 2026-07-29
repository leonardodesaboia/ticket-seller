import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

const EVENT_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;

export class UpdateEventConfigurationDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  format?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  timezone?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  onlineInfo?: string | null;

  @IsOptional()
  @IsBoolean()
  clearOnlineInfo?: boolean;

  @IsOptional()
  @IsUUID('4')
  venueId?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
