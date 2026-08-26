import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  ADMIN_PAYOUT_REPOSITORY,
  IAdminPayoutRepository,
} from '../../domain/ports/admin-payout-repository.port';

export interface BlockPayoutCommand {
  actorId: string;
  payoutId: string;
  reason: string;
}

const BLOCKABLE_STATUSES = ['SCHEDULED', 'PROCESSING'];

@Injectable()
export class BlockPayoutUseCase {
  private readonly logger = new Logger(BlockPayoutUseCase.name);

  constructor(
    @Inject(ADMIN_PAYOUT_REPOSITORY)
    private readonly payoutRepo: IAdminPayoutRepository,
  ) {}

  async execute(command: BlockPayoutCommand): Promise<void> {
    const payout = await this.payoutRepo.findById(command.payoutId);

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!BLOCKABLE_STATUSES.includes(payout.status)) {
      throw new UnprocessableEntityException(
        `Payout cannot be blocked in status '${payout.status}'. Only SCHEDULED or PROCESSING payouts can be blocked.`,
      );
    }

    const result = await this.payoutRepo.blockIfBlockable(command.payoutId, BLOCKABLE_STATUSES);

    if (result.count === 0) {
      throw new UnprocessableEntityException(
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
