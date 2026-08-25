import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../../domain/media.constants';

export class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;
}
