import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface BlockPayoutCommand {
  actorId: string;
  payoutId: string;
  reason: string;
}

const BLOCKABLE_STATUSES = ['SCHEDULED', 'PROCESSING'];

@Injectable()
export class BlockPayoutUseCase {
  private readonly logger = new Logger(BlockPayoutUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: BlockPayoutCommand): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: command.payoutId },
      select: { id: true, status: true },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!BLOCKABLE_STATUSES.includes(payout.status)) {
      throw new UnprocessableEntityException(
        `Payout cannot be blocked in status '${payout.status}'. Only SCHEDULED or PROCESSING payouts can be blocked.`,
      );
    }

    const result = await this.prisma.payout.updateMany({
      where: { id: command.payoutId, status: { in: BLOCKABLE_STATUSES } },
      data: { status: 'BLOCKED' },
    });

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
