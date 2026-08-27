import { createHash, randomBytes } from 'crypto';
import {
  type IReservationRepository,
  type ReservationItemInput,
  type ReservationView,
} from '../../domain/ports/reservation-repository.port';

export interface CreateReservationCommand {
  eventSlug: string;
  items: ReservationItemInput[];
  idempotencyKey: string;
}

export interface CreateReservationResult {
  reservation: ReservationView;
  token?: string;
}

function hashPayload(command: CreateReservationCommand): string {
  const items = [...command.items]
    .map((item) => ({ ticketTypeId: item.ticketTypeId, quantity: item.quantity }))
    .sort((left, right) => left.ticketTypeId.localeCompare(right.ticketTypeId));
  return createHash('sha256').update(JSON.stringify({ eventSlug: command.eventSlug, items })).digest('hex');
}

export class CreateReservationUseCase {
  constructor(
    private readonly repository: IReservationRepository,
  ) {}

  async execute(command: CreateReservationCommand): Promise<CreateReservationResult> {
    const token = randomBytes(32).toString('hex');
    const result = await this.repository.create({
      eventSlug: command.eventSlug,
      items: command.items,
      idempotencyKey: command.idempotencyKey,
      requestHash: hashPayload(command),
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return { reservation: result.reservation, ...(result.replayed ? {} : { token }) };
  }
}
