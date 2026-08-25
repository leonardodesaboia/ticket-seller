import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { OrganizationRoleGuard } from '../../../../platform/http/guards/organization-role.guard';
import { RequireCapability } from '../../../../platform/http/decorators/require-capability.decorator';
import { OrganizationCapability } from '../../../../shared/kernel/organization-capability';
import { GetOrganizationBalanceUseCase } from '../../application/use-cases/get-organization-balance.use-case';
import { RegisterPayoutRecipientUseCase } from '../../application/use-cases/register-payout-recipient.use-case';
import { CreatePayoutUseCase } from '../../application/use-cases/create-payout.use-case';
import { GetFinancialSummaryUseCase } from '../../application/use-cases/get-financial-summary.use-case';
import { ListLedgerTransactionsUseCase } from '../../application/use-cases/list-ledger-transactions.use-case';
import { ListPayoutsUseCase } from '../../application/use-cases/list-payouts.use-case';
import { PayoutRecipient } from '../../domain/entities/payout-recipient.entity';
import { Payout } from '../../domain/entities/payout.entity';

class CreatePayoutBody {
  @ApiProperty({ description: 'Amount in minor units as integer string (e.g. centavos)', example: '10000' })
  @IsString()
  @Matches(/^\d+$/, { message: 'amount must be a non-negative integer string' })
  amount!: string;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'BRL' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({ description: 'Unique idempotency key for this payout (UUID v4)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID('4')
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
@UseGuards(ActorGuard, OrganizationRoleGuard)
export class FinanceController {
  constructor(
    private readonly getBalanceUseCase: GetOrganizationBalanceUseCase,
    private readonly registerPayoutRecipientUseCase: RegisterPayoutRecipientUseCase,
    private readonly createPayoutUseCase: CreatePayoutUseCase,
    private readonly getFinancialSummaryUseCase: GetFinancialSummaryUseCase,
    private readonly listLedgerTransactionsUseCase: ListLedgerTransactionsUseCase,
    private readonly listPayoutsUseCase: ListPayoutsUseCase,
  ) {}

  @Get('balance')
  @RequireCapability(OrganizationCapability.FINANCE_READ)
  @ApiOperation({ summary: 'Get organization seller balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getBalance(@Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string): Promise<BalanceResponse> {
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
  @RequireCapability(OrganizationCapability.PAYOUT_REQUEST)
  @ApiOperation({ summary: 'Register payout recipient for organization (OWNER only)' })
  @ApiResponse({ status: 201, description: 'Recipient registered or returned if already exists' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async registerRecipient(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
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
  @RequireCapability(OrganizationCapability.PAYOUT_REQUEST)
  @ApiOperation({ summary: 'Create a payout (OWNER or FINANCE role required)' })
  @ApiResponse({ status: 201, description: 'Payout created and dispatched to provider' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 422, description: 'Insufficient balance or recipient not verified' })
  async createPayout(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Body() body: CreatePayoutBody,
  ): Promise<PayoutResponse> {
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

  @Get('summary')
  @RequireCapability(OrganizationCapability.FINANCE_READ)
  @ApiOperation({ summary: 'Get financial summary for a date range' })
  @ApiQuery({ name: 'from', required: true, description: 'ISO date start (inclusive)' })
  @ApiQuery({ name: 'to', required: true, description: 'ISO date end (inclusive)' })
  @ApiResponse({ status: 200, description: 'Financial summary retrieved' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getSummary(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format for "from" or "to" (ISO 8601 expected)');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('"from" must be before "to"');
    }
    return this.getFinancialSummaryUseCase.execute({
      organizationId: orgId,
      from: fromDate,
      to: toDate,
    });
  }

  @Get('transactions')
  @RequireCapability(OrganizationCapability.FINANCE_READ)
  @ApiOperation({ summary: 'List ledger transactions with keyset pagination' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Ledger transactions listed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async listTransactions(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)) {
      throw new BadRequestException('limit must be an integer between 1 and 200');
    }
    return this.listLedgerTransactionsUseCase.execute({
      organizationId: orgId,
      ...(cursor !== undefined && { cursor }),
      ...(parsedLimit !== undefined && { limit: parsedLimit }),
    });
  }

  @Get('payouts')
  @RequireCapability(OrganizationCapability.FINANCE_READ)
  @ApiOperation({ summary: 'List payouts with keyset pagination' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Payouts listed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async listPayouts(
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)) {
      throw new BadRequestException('limit must be an integer between 1 and 200');
    }
    return this.listPayoutsUseCase.execute({
      organizationId: orgId,
      ...(cursor !== undefined && { cursor }),
      ...(parsedLimit !== undefined && { limit: parsedLimit }),
    });
  }
}
