export class EmailSendError extends Error {
  constructor(cause?: Error) {
    super('Failed to send email');
    this.name = 'EmailSendError';
    if (cause) this.cause = cause;
  }
}

export class NotificationAlreadySentError extends Error {
  constructor(orderId: string, eventType: string) {
    super(`Notification already sent for order ${orderId} and event ${eventType}`);
    this.name = 'NotificationAlreadySentError';
  }
}
