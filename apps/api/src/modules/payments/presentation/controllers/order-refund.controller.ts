import {
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { OrganizationRoleGuard } from '../../../../platform/http/guards/organization-role.guard';
import { RequireCapability } from '../../../../platform/http/decorators/require-capability.decorator';
import { OrganizationCapability } from '../../../../shared/kernel/organization-capability';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { ProcessRefundUseCase } from '../../application/use-cases/process-refund.use-case';
import {
  OrderNotFoundForRefundError,
  OrderNotRefundableError,
  RefundGatewayError,
} from '../../domain/refund.errors';
import { RefundResponse } from '../dto/refund.response';

@ApiTags('refunds')
@Controller('organizations/:orgId/orders/:orderId/refunds')
@UseGuards(ActorGuard, OrganizationRoleGuard)
@RequireCapability(OrganizationCapability.PAYOUT_REQUEST)
export class OrderRefundController {
  constructor(private readonly processRefund: ProcessRefundUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async refund(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @CurrentActor() actor: ICurrentActor,
  ): Promise<RefundResponse> {
    try {
      const result = await this.processRefund.execute({
        orderId,
        organizationId: orgId,
        actorId: actor.userId,
      });
      return RefundResponse.from(result);
    } catch (err) {
      if (err instanceof OrderNotFoundForRefundError) {
        throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
      }
      if (err instanceof OrderNotRefundableError) {
        throw new UnprocessableEntityException({
          message: err.message,
          code: err.code,
        });
      }
      if (err instanceof RefundGatewayError) {
        throw new ServiceUnavailableException({
          message: 'Refund gateway error — please retry',
          code: 'REFUND_GATEWAY_ERROR',
        });
      }
      throw err;
    }
  }
}
