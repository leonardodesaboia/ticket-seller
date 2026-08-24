import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SuspendDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason!: string;
}
