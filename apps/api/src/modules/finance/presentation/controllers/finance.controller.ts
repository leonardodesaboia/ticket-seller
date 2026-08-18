import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { GetOrganizationBalanceUseCase } from '../../application/use-cases/get-organization-balance.use-case';
import { RegisterPayoutRecipientUseCase } from '../../application/use-cases/register-payout-recipient.use-case';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';

interface BalanceResponse {
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

interface PayoutRecipientResponse {
  id: string;
  organizationId: string;
  provider: string;
  externalRecipientId: string | null;
  status: PayoutRecipient['status'];
  createdAt: string;
  updatedAt: string;
}

@ApiTags('finance')
@Controller('organizations/:orgId/finance')
@UseGuards(ActorGuard)
export class FinanceController {
  constructor(
    private readonly getBalanceUseCase: GetOrganizationBalanceUseCase,
    private readonly registerPayoutRecipientUseCase: RegisterPayoutRecipientUseCase,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get organization seller balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getBalance(@Param('orgId') orgId: string): Promise<BalanceResponse> {
    const result = await this.getBalanceUseCase.execute(orgId);
    // Serialize bigint as string for JSON transport
    return {
      pendingAmount: result.pendingAmount.toString(),
      availableAmount: result.availableAmount.toString(),
      reservedAmount: result.reservedAmount.toString(),
      currency: result.currency,
    };
  }

  @Post('recipient')
  @ApiOperation({ summary: 'Register payout recipient for organization (OWNER only)' })
  @ApiResponse({ status: 201, description: 'Recipient registered or returned if already exists' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async registerRecipient(
    @Param('orgId') orgId: string,
  ): Promise<PayoutRecipientResponse> {
    const recipient = await this.registerPayoutRecipientUseCase.execute(orgId);
    return {
      id: recipient.id,
      organizationId: recipient.organizationId,
      provider: recipient.provider,
      externalRecipientId: recipient.externalRecipientId,
      status: recipient.status,
      createdAt: recipient.createdAt.toISOString(),
      updatedAt: recipient.updatedAt.toISOString(),
    };
  }
}
