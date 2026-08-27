import {
  IPayoutListQueryPort,
  PayoutItem,
} from '../ports/payout-list-query.port';

export type { PayoutItem };

export interface ListPayoutsInput {
  organizationId: string;
  cursor?: string;
  limit?: number;
}

export interface ListPayoutsResult {
  data: PayoutItem[];
  nextCursor: string | null;
}

export class ListPayoutsUseCase {
  constructor(private readonly queryPort: IPayoutListQueryPort) {}

  async execute(input: ListPayoutsInput): Promise<ListPayoutsResult> {
    const { organizationId, cursor, limit = 20 } = input;
    const pageSize = Math.min(limit, 100);

    return this.queryPort.query({
      organizationId,
      ...(cursor !== undefined && { cursor }),
      limit: pageSize,
    });
  }
}
