import { Inject, Injectable } from '@nestjs/common';
import {
  PAYMENT_ATTEMPT_REPOSITORY,
  IPaymentAttemptRepository,
} from '../../domain/ports/payment-attempt-repository.port';
import { ORDER_ACCESS_PORT, IOrderAccessPort } from '../ports/order-access.port';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';
import {
  InvalidReservationTokenForPaymentError,
  PaymentAttemptNotFoundError,
} from '../../domain/payment-attempt.errors';

@Injectable()
export class GetPaymentAttemptUseCase {
  constructor(
    @Inject(PAYMENT_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IPaymentAttemptRepository,
    @Inject(ORDER_ACCESS_PORT)
    private readonly orderAccess: IOrderAccessPort,
  ) {}

  async execute(orderId: string, reservationToken: string): Promise<PaymentAttempt> {
    const order = await this.orderAccess.findOrderWithToken(orderId, reservationToken);
    if (!order) {
      throw new InvalidReservationTokenForPaymentError();
    }

    const attempt = await this.attemptRepo.findLatestByOrderId(orderId);
    if (!attempt) {
      throw new PaymentAttemptNotFoundError(orderId);
    }

    return attempt;
  }
}
