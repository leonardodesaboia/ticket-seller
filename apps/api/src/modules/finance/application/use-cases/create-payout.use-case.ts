import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  PAYOUT_REPOSITORY,
  IPayoutRepository,
} from '../../domain/ports/payout.repository.port';
import {
  PAYOUT_RECIPIENT_REPOSITORY,
  IPayoutRecipientRepository,
} from '../../domain/ports/payout-recipient.repository.port';
import {
  SELLER_BALANCE_REPOSITORY,
  ISellerBalanceRepository,
} from '../../domain/ports/seller-balance.repository.port';
import {
  LEDGER_REPOSITORY,
  ILedgerRepository,
} from '../../domain/ports/ledger.repository.port';
import {
  PAYOUT_GATEWAY_PORT,
  IPayoutGatewayPort,
} from '../../domain/ports/payout-gateway.port';
import { Payout } from '../../domain/entities/payout.entity';

export interface CreatePayoutInput {
  organizationId: string;
  amount: bigint;
  currency: string;
  idempotencyKey: string;
}

export class InsufficientBalanceException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'Insufficient available balance for payout',
      code: 'INSUFFICIENT_BALANCE',
    });
  }
}

@Injectable()
export class CreatePayoutUseCase {
  private readonly logger = new Logger(CreatePayoutUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYOUT_REPOSITORY)
    private readonly payoutRepo: IPayoutRepository,
    @Inject(PAYOUT_RECIPIENT_REPOSITORY)
    private readonly recipientRepo: IPayoutRecipientRepository,
    @Inject(SELLER_BALANCE_REPOSITORY)
    private readonly balanceRepo: ISellerBalanceRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepo: ILedgerRepository,
    @Inject(PAYOUT_GATEWAY_PORT)
    private readonly gateway: IPayoutGatewayPort,
  ) {}

  async execute(input: CreatePayoutInput): Promise<Payout> {
    const { organizationId, amount, currency, idempotencyKey } = input;

    // Step 1: Verify recipient exists and is VERIFIED (outside transaction — read-only)
    const recipient = await this.recipientRepo.findByOrg(organizationId);
    if (!recipient || recipient.status !== 'VERIFIED' || !recipient.externalRecipientId) {
      throw new UnprocessableEntityException({
        message: 'No verified payout recipient found for organization',
        code: 'RECIPIENT_NOT_VERIFIED',
      });
    }

    // Steps 2–8: Atomic transaction
    const { payout, isNew } = await this.prisma.$transaction(async (tx) => {
      // Step 3: SELECT FOR UPDATE on seller_balances — serializes concurrent payouts
      const balance = await this.balanceRepo.findByOrgForUpdate(organizationId, tx);
      if (!balance) {
        throw new NotFoundException({
          message: 'Seller balance not found for organization',
          code: 'BALANCE_NOT_FOUND',
        });
      }

      // Step 5: INSERT payout (ON CONFLICT idempotency_key → returns existing + inserted flag)
      const { payout: existingOrNew, inserted } = await this.payoutRepo.create(
        {
          organizationId,
          recipientId: recipient.id,
          amount,
          currency,
          status: 'SCHEDULED',
          provider: this.gateway.provider,
          externalPayoutId: null,
          idempotencyKey,
          failureReason: null,
          requestedAt: new Date(),
          succeededAt: null,
          failedAt: null,
        },
        tx,
      );

      // Idempotency: if the payout already existed, return it without touching balances or ledger
      if (!inserted) {
        this.logger.log(
          `CreatePayout: idempotency hit for key=${idempotencyKey}, returning existing payout id=${existingOrNew.id}`,
        );
        return { payout: existingOrNew, isNew: false };
      }

      // Step 4: Verify available_amount >= amount (checked AFTER lock to prevent TOCTOU)
      if (balance.availableAmount < amount) {
        throw new InsufficientBalanceException();
      }

      // Step 6: UPDATE seller_balances: available -= amount, reserved += amount
      await tx.$executeRaw`
        UPDATE seller_balances
        SET available_amount = available_amount - ${amount},
            reserved_amount  = reserved_amount  + ${amount},
            version          = version + 1,
            updated_at       = NOW()
        WHERE organization_id = ${organizationId}::uuid
      `;

      // Step 7: Ledger PAYOUT_REQUESTED
      // DEBIT SELLER_PAYABLE[org] — reduces what platform owes to seller
      // CREDIT PAYOUT_CLEARING[org] — records funds in transit to provider
      const sellerPayable = await this.ledgerRepo.findOrCreateOrgAccount(
        `SELLER_PAYABLE:${organizationId}`,
        'Seller Payable',
        'LIABILITY',
        organizationId,
        currency,
        tx,
      );

      const payoutClearing = await this.ledgerRepo.findOrCreateOrgAccount(
        `PAYOUT_CLEARING:${organizationId}`,
        'Payout Clearing',
        'LIABILITY',
        organizationId,
        currency,
        tx,
      );

      await this.ledgerRepo.recordTransaction(
        {
          sourceType: 'PAYOUT_REQUESTED',
          sourceId: existingOrNew.id,
          description: `Payout requested for organization ${organizationId}`,
          entries: [
            {
              accountId: sellerPayable.id,
              entryType: 'DEBIT',
              amount,
              currency,
              description: `PAYOUT_REQUESTED: debit seller payable for payout ${existingOrNew.id}`,
            },
            {
              accountId: payoutClearing.id,
              entryType: 'CREDIT',
              amount,
              currency,
              description: `PAYOUT_REQUESTED: credit payout clearing for payout ${existingOrNew.id}`,
            },
          ],
        },
        tx,
      );

      return { payout: existingOrNew, isNew: true };
    });

    // Step 9: OUTSIDE transaction — call gateway.createPayout
    // CRITICAL: Never hold the DB transaction open during HTTP calls
    if (isNew && payout.externalPayoutId === null) {
      try {
        const gatewayResult = await this.gateway.createPayout({
          organizationId,
          externalRecipientId: recipient.externalRecipientId,
          amount,
          currency,
          idempotencyKey,
        });

        await this.payoutRepo.updateExternalId(
          payout.id,
          gatewayResult.externalPayoutId,
          'PROCESSING',
        );

        this.logger.log(
          `Payout dispatched: payoutId=${payout.id}, status=PROCESSING`,
        );

        return {
          ...payout,
          externalPayoutId: gatewayResult.externalPayoutId,
          status: 'PROCESSING',
        };
      } catch (error) {
        this.logger.error(
          `Failed to dispatch payout to provider: payoutId=${payout.id}, error=${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Re-throw so the caller receives the error; the payout stays SCHEDULED
        // and can be retried (the idempotency_key deduplicates the balance reservation)
        throw error;
      }
    }

    return payout;
  }
}
