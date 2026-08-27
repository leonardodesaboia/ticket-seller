import {
  ILedgerTransactionListQueryPort,
  LedgerTransactionItem,
} from '../ports/ledger-transaction-list-query.port';

export type { LedgerTransactionItem };

export interface ListLedgerTransactionsInput {
  organizationId: string;
  cursor?: string;
  limit?: number;
}

export interface ListLedgerTransactionsResult {
  data: LedgerTransactionItem[];
  nextCursor: string | null;
}

export class ListLedgerTransactionsUseCase {
  constructor(private readonly queryPort: ILedgerTransactionListQueryPort) {}

  async execute(input: ListLedgerTransactionsInput): Promise<ListLedgerTransactionsResult> {
    const { organizationId, cursor, limit = 20 } = input;
    const pageSize = Math.min(limit, 100);

    return this.queryPort.query({
      organizationId,
      ...(cursor !== undefined && { cursor }),
      limit: pageSize,
    });
  }
}
