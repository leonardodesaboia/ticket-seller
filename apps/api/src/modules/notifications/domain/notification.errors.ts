export class EmailSendError extends Error {
  constructor(message = 'Failed to send email', cause?: Error) {
    super(message);
    this.name = 'EmailSendError';
    if (cause) this.cause = cause;
  }
}
