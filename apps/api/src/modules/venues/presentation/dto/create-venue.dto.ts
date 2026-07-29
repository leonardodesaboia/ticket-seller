import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  name!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  state!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;
}
