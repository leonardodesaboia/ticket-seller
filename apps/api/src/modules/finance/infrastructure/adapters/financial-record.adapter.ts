import { Injectable } from '@nestjs/common';
import {
  IFinancialRecordPort,
  RecordSaleInput,
  RecordRefundInput,
  RecordChargebackInput,
} from '../../domain/ports/financial-record.port';
import { RecordSaleUseCase } from '../../application/use-cases/record-sale.use-case';
import { RecordRefundUseCase } from '../../application/use-cases/record-refund.use-case';
import { RecordChargebackUseCase } from '../../application/use-cases/record-chargeback.use-case';

@Injectable()
export class FinancialRecordAdapter implements IFinancialRecordPort {
  constructor(
    private readonly recordSaleUseCase: RecordSaleUseCase,
    private readonly recordRefundUseCase: RecordRefundUseCase,
    private readonly recordChargebackUseCase: RecordChargebackUseCase,
  ) {}

  async recordSale(input: RecordSaleInput): Promise<void> {
    await this.recordSaleUseCase.execute(input);
  }

  async recordRefund(input: RecordRefundInput): Promise<void> {
    await this.recordRefundUseCase.execute(input);
  }

  async recordChargeback(input: RecordChargebackInput): Promise<void> {
    await this.recordChargebackUseCase.execute(input);
  }
}
