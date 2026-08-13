import { ApiProperty } from '@nestjs/swagger';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';

export class PaymentAttemptResponse {
  @ApiProperty() paymentAttemptId!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() status!: string;
  @ApiProperty() paymentMethod!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ nullable: true }) checkoutData!: Record<string, unknown> | null;

  static from(attempt: PaymentAttempt): PaymentAttemptResponse {
    const r = new PaymentAttemptResponse();
    r.paymentAttemptId = attempt.id;
    r.orderId = attempt.orderId;
    r.provider = attempt.provider;
    r.status = attempt.status;
    r.paymentMethod = attempt.paymentMethod;
    r.amount = Number(attempt.amount);
    r.currency = attempt.currency;
    r.expiresAt = attempt.expiresAt.toISOString();
    r.checkoutData = attempt.checkoutData;
    return r;
  }
}
