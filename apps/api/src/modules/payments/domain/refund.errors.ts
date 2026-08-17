export class OrderNotFoundForRefundError extends Error {
  constructor() {
    super('Order not found');
    this.name = 'OrderNotFoundForRefundError';
  }
}

export class OrderNotRefundableError extends Error {
  constructor(public readonly code: string) {
    super(`Order is not refundable: ${code}`);
    this.name = 'OrderNotRefundableError';
  }
}

export class RefundGatewayError extends Error {
  constructor(public readonly detail?: string) {
    super('Refund gateway error');
    this.name = 'RefundGatewayError';
  }
}
