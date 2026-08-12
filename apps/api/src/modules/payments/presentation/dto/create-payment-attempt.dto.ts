import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CreatePaymentAttemptDto {
  @ApiProperty({ enum: ['FAKE_PIX', 'FAKE_CREDIT_CARD'] })
  @IsIn(['FAKE_PIX', 'FAKE_CREDIT_CARD'])
  paymentMethod!: string;
}
