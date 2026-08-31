import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../../../platform/config/env';
import type { IEmailProvider, EmailMessage } from '../../domain/ports/email-provider.port';
import { EmailSendError } from '../../domain/notification.errors';

@Injectable()
export class ResendEmailAdapter implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private resend: Resend | null = null;

  private getClient(): Resend {
    if (!this.resend) {
      if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }
      this.resend = new Resend(env.RESEND_API_KEY);
    }
    return this.resend;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.getClient().emails.send({
        from: env.RESEND_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html !== undefined ? { html: message.html } : {}),
      });
    } catch (err) {
      throw new EmailSendError(`Resend delivery failed: ${String(err)}`, err instanceof Error ? err : undefined);
    }

    this.logger.debug(`Email sent via Resend — subject: "${message.subject}"`);
  }
}
