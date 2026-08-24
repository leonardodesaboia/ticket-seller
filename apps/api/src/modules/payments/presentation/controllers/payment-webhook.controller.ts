import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { SkipThrottle } from '../../../../platform/http/decorators/throttle.decorator';
import { ProcessPaymentWebhookUseCase } from '../../application/use-cases/process-payment-webhook.use-case';
import { WebhookSignatureError } from '../../domain/payment-gateway.errors';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly processWebhook: ProcessPaymentWebhookUseCase) {}

  @Post('fake')
  @HttpCode(HttpStatus.OK)
  async handleFake(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('x-fake-signature') signature: string | undefined,
  ): Promise<Record<string, never>> {
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      throw new BadRequestException({ message: 'Missing body or signature', code: 'INVALID_WEBHOOK' });
    }

    try {
      await this.processWebhook.execute({
        provider: 'FAKE',
        rawBody,
        signature,
      });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        // Return 400 without revealing why — security best practice
        throw new BadRequestException({ message: 'Invalid webhook', code: 'INVALID_WEBHOOK' });
      }
      throw error;
    }

    return {};
  }
}
