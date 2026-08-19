import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}
