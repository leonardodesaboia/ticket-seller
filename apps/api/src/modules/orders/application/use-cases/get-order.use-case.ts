import { createHash } from 'crypto';
import { type IOrderRepository, type OrderView } from '../../domain/ports/order-repository.port';

export class GetOrderUseCase {
  constructor(private readonly repository: IOrderRepository) {}

  execute(orderId: string, reservationToken: string): Promise<OrderView> {
    const tokenHash = createHash('sha256').update(reservationToken).digest('hex');
    return this.repository.get(orderId, tokenHash);
  }
}
