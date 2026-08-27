import {
  IPaymentAttemptRepository,
} from '../../domain/ports/payment-attempt-repository.port';
import { IOrderAccessPort } from '../ports/order-access.port';
import { PaymentAttempt } from '../../domain/payment-attempt.entity';
import {
  InvalidReservationTokenForPaymentError,
  PaymentAttemptNotFoundError,
} from '../../domain/payment-attempt.errors';

export class GetPaymentAttemptUseCase {
  constructor(
    private readonly attemptRepo: IPaymentAttemptRepository,
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
