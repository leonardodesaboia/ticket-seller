import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { IFinanceTransactionRunner } from '../../application/ports/finance-transaction-runner.port';

@Injectable()
export class PrismaFinanceTransactionRunner implements IFinanceTransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
