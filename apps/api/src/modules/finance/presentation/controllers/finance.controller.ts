import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { GetOrganizationBalanceUseCase } from '../../application/use-cases/get-organization-balance.use-case';

interface BalanceResponse {
  pendingAmount: string;
  availableAmount: string;
  reservedAmount: string;
  currency: string;
}

@ApiTags('finance')
@Controller('organizations/:orgId/finance')
@UseGuards(ActorGuard)
export class FinanceController {
  constructor(
    private readonly getBalanceUseCase: GetOrganizationBalanceUseCase,
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
}
