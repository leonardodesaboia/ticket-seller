export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class GatewayTimeoutError extends GatewayError {
  constructor() {
    super('Payment gateway timeout');
    this.name = 'GatewayTimeoutError';
  }
}

export class WebhookSignatureError extends GatewayError {
  constructor() {
    super('Invalid webhook signature');
    this.name = 'WebhookSignatureError';
  }
}
