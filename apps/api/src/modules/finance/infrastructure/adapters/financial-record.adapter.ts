import { Injectable } from '@nestjs/common';
import {
  IFinancialRecordPort,
  RecordSaleInput,
} from '../../domain/ports/financial-record.port';
import { RecordSaleUseCase } from '../../application/use-cases/record-sale.use-case';

@Injectable()
export class FinancialRecordAdapter implements IFinancialRecordPort {
  constructor(private readonly recordSaleUseCase: RecordSaleUseCase) {}

  async recordSale(input: RecordSaleInput): Promise<void> {
    await this.recordSaleUseCase.execute(input);
  }
}
