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
import { ProcessPayoutWebhookUseCase } from '../../application/use-cases/process-payout-webhook.use-case';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/payouts')
export class PayoutWebhookController {
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

    await this.processWebhook.execute({ rawBody, signature });

    return {};
  }
}
