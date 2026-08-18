import * as crypto from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  IPayoutGatewayPort,
  CreateRecipientInput,
  CreateRecipientOutput,
  CreatePayoutInput,
  CreatePayoutOutput,
  GetPayoutStatusOutput,
  ParsedWebhookEvent,
} from '../../../domain/ports/payout-gateway.port';

interface FakePayoutWebhookBody {
  eventId: string;
  externalPayoutId: string;
  eventType: string;
  amount: number;
  currency: string;
}

@Injectable()
export class FakePayoutGateway implements IPayoutGatewayPort {
  readonly provider = 'FAKE';

  private readonly secret: string;
  private readonly logger = new Logger(FakePayoutGateway.name);

  // In-memory status map for getPayoutStatus
  private readonly payoutStatusMap = new Map<string, 'PROCESSING' | 'PAID' | 'FAILED'>();

  constructor() {
    const secret = process.env['FAKE_PAYOUT_SECRET'];
    if (!secret) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('FAKE_PAYOUT_SECRET is required in production');
      }
      this.logger.warn('FAKE_PAYOUT_SECRET not set — using insecure default for development');
      this.secret = 'dev-payout-secret';
    } else {
      this.secret = secret;
    }
  }

  async createRecipient(input: CreateRecipientInput): Promise<CreateRecipientOutput> {
    const hash = crypto.createHash('sha256').update(input.organizationId).digest('hex');
    const externalRecipientId = 'fake_recipient_' + hash.slice(0, 24);

    return {
      externalRecipientId,
      status: 'VERIFIED',
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutOutput> {
    const hash = crypto.createHash('sha256').update(input.idempotencyKey).digest('hex');
    const externalPayoutId = 'fake_payout_' + hash.slice(0, 24);

    this.payoutStatusMap.set(externalPayoutId, 'PROCESSING');

    return {
      externalPayoutId,
      status: 'PROCESSING',
    };
  }

  async getPayoutStatus(externalPayoutId: string): Promise<GetPayoutStatusOutput> {
    const status = this.payoutStatusMap.get(externalPayoutId) ?? 'PROCESSING';

    return {
      externalPayoutId,
      status,
    };
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): ParsedWebhookEvent {
    this.validateSignature(rawBody, signature);

    let body: FakePayoutWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as FakePayoutWebhookBody;
    } catch {
      throw new Error('Invalid payout webhook body: not valid JSON');
    }

    if (
      !body.eventId ||
      !body.externalPayoutId ||
      !body.eventType ||
      body.amount == null ||
      !body.currency
    ) {
      throw new Error('Invalid payout webhook body: missing required fields');
    }

    const validEventTypes: Array<ParsedWebhookEvent['eventType']> = ['SUCCEEDED', 'FAILED'];
    if (!validEventTypes.includes(body.eventType as ParsedWebhookEvent['eventType'])) {
      throw new Error(`Unknown payout event type: ${body.eventType}`);
    }

    const eventType = body.eventType as ParsedWebhookEvent['eventType'];

    // Update in-memory status map when processing webhook
    const newStatus: 'PROCESSING' | 'PAID' | 'FAILED' =
      eventType === 'SUCCEEDED' ? 'PAID' : 'FAILED';
    this.payoutStatusMap.set(body.externalPayoutId, newStatus);

    return {
      provider: this.provider,
      providerEventId: body.eventId,
      externalPayoutId: body.externalPayoutId,
      eventType,
      amount: BigInt(body.amount),
      currency: body.currency,
      rawPayload: body as unknown as Record<string, unknown>,
    };
  }

  private validateSignature(rawBody: Buffer, signature: string): void {
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signature);

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new UnauthorizedException('Invalid payout webhook signature');
    }
  }
}
