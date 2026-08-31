import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import type { IEmailProvider, EmailMessage } from "../../domain/ports/email-provider.port";
import { EmailSendError } from "../../domain/notification.errors";
import { env } from "../../../../platform/config/env";

@Injectable()
export class MailpitEmailAdapter implements IEmailProvider, OnModuleInit {
  private readonly logger = new Logger(MailpitEmailAdapter.name);
  private transporter!: Transporter;

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    });

    this.logger.log(`SMTP transport configured — ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html !== undefined ? { html: message.html } : {}),
      });
    } catch (err) {
      throw new EmailSendError(`SMTP delivery failed: ${String(err)}`, err instanceof Error ? err : undefined);
    }

    this.logger.debug(`Email sent — subject: "${message.subject}"`);
  }
}
