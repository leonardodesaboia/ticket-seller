import { NotFoundError, UnprocessableError } from '../../../../shared/kernel/application-errors';
import { ILogger } from '../../../../shared/kernel/logger.port';
import {
  IAdminPayoutRepository,
} from '../../domain/ports/admin-payout-repository.port';

export interface BlockPayoutCommand {
  actorId: string;
  payoutId: string;
  reason: string;
}

const BLOCKABLE_STATUSES = ['SCHEDULED', 'PROCESSING'];

export class BlockPayoutUseCase {
  constructor(
    private readonly payoutRepo: IAdminPayoutRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: BlockPayoutCommand): Promise<void> {
    const payout = await this.payoutRepo.findById(command.payoutId);

    if (!payout) {
      throw new NotFoundError('Payout not found');
    }

    if (!BLOCKABLE_STATUSES.includes(payout.status)) {
      throw new UnprocessableError(
        `Payout cannot be blocked in status '${payout.status}'. Only SCHEDULED or PROCESSING payouts can be blocked.`,
      );
    }

    const result = await this.payoutRepo.blockIfBlockable(command.payoutId, BLOCKABLE_STATUSES);

    if (result.count === 0) {
      throw new UnprocessableError(
        'Payout status changed concurrently and can no longer be blocked.',
      );
    }

    this.logger.log({
      msg: 'platform_admin_action',
      actor: command.actorId,
      resource: 'Payout',
      action: 'BLOCK',
      resourceId: command.payoutId,
      reason: command.reason,
    });
  }
}
