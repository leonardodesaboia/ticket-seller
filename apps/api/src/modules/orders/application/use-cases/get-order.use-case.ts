import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY, type IOrderRepository, type OrderView } from '../../domain/ports/order-repository.port';

@Injectable()
export class GetOrderUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly repository: IOrderRepository) {}

  execute(orderId: string, reservationToken: string): Promise<OrderView> {
    const tokenHash = createHash('sha256').update(reservationToken).digest('hex');
    return this.repository.get(orderId, tokenHash);
  }
}
