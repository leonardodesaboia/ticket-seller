import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { SkipThrottle } from '../../../../platform/http/decorators/throttle.decorator';
import { ProcessPayoutWebhookUseCase } from '../../application/use-cases/process-payout-webhook.use-case';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/payouts')
export class PayoutWebhookController {
  private readonly logger = new Logger(PayoutWebhookController.name);

  constructor(private readonly processWebhook: ProcessPayoutWebhookUseCase) {}

  @Post('fake')
  @HttpCode(HttpStatus.OK)
  async handleFake(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('x-payout-signature') signature: string | undefined,
  ): Promise<Record<string, never>> {
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      throw new BadRequestException({
        message: 'Missing body or signature',
        code: 'INVALID_WEBHOOK',
      });
    }

    try {
      await this.processWebhook.execute({ rawBody, signature });
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw new BadRequestException({ message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' });
      }
      this.logger.error('Unexpected error processing payout webhook', err instanceof Error ? err.stack : String(err));
      throw new BadRequestException({ message: 'Webhook processing failed', code: 'WEBHOOK_ERROR' });
    }

    return {};
  }
}
