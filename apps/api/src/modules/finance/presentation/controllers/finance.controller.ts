import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { GetOrganizationBalanceUseCase } from '../../application/use-cases/get-organization-balance.use-case';
import { RegisterPayoutRecipientUseCase } from '../../application/use-cases/register-payout-recipient.use-case';
import { CreatePayoutUseCase } from '../../application/use-cases/create-payout.use-case';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';
import { Payout } from '../../domain/entities/payout.entity';

class CreatePayoutBody {
  @ApiProperty({ description: 'Amount in minor units (e.g. centavos)', example: 10000 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'BRL' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({ description: 'Unique idempotency key for this payout', example: 'payout-uuid-here' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

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

interface PayoutResponse {
  id: string;
  organizationId: string;
  recipientId: string;
  amount: string;
  currency: string;
  status: Payout['status'];
  provider: string;
  idempotencyKey: string;
  requestedAt: string;
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
    private readonly createPayoutUseCase: CreatePayoutUseCase,
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

  @Post('payouts')
  @ApiOperation({ summary: 'Create a payout (OWNER or FINANCE role required)' })
  @ApiResponse({ status: 201, description: 'Payout created and dispatched to provider' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 422, description: 'Insufficient balance or recipient not verified' })
  async createPayout(
    @Param('orgId') orgId: string,
    @Body() body: CreatePayoutBody,
  ): Promise<PayoutResponse> {
    // Convert amount from number (minor units in body) to bigint
    const payout = await this.createPayoutUseCase.execute({
      organizationId: orgId,
      amount: BigInt(body.amount),
      currency: body.currency,
      idempotencyKey: body.idempotencyKey,
    });

    return {
      id: payout.id,
      organizationId: payout.organizationId,
      recipientId: payout.recipientId,
      amount: payout.amount.toString(),
      currency: payout.currency,
      status: payout.status,
      provider: payout.provider,
      idempotencyKey: payout.idempotencyKey,
      requestedAt: payout.requestedAt.toISOString(),
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
    };
  }
}
