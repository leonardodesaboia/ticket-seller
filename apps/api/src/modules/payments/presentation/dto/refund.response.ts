import { ProcessRefundResult } from '../../application/use-cases/process-refund.use-case';

export class RefundResponse {
  orderId!: string;
  organizationId!: string;
  status!: 'REFUNDED';
  refundedAmount!: number;
  currency!: string;
  externalRefundId!: string;

  static from(result: ProcessRefundResult): RefundResponse {
    const res = new RefundResponse();
    res.orderId = result.orderId;
    res.organizationId = result.organizationId;
    res.status = result.status;
    res.refundedAmount = result.refundedAmount;
    res.currency = result.currency;
    res.externalRefundId = result.externalRefundId;
    return res;
  }
}
