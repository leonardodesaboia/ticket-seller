import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
