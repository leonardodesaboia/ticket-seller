import { Module } from '@nestjs/common';
import { CHECK_IN_REPOSITORY } from '../domain/ports/check-in-repository.port';
import { EVENT_ACCESS_FOR_CHECKIN_PORT } from '../application/ports/event-access.port';
import { TICKET_ACCESS_FOR_CHECKIN_PORT } from '../application/ports/ticket-access.port';
import { PrismaCheckInRepository } from './repositories/prisma-check-in.repository';
import { EventAccessAdapter } from './adapters/event-access.adapter';
import { TicketAccessAdapter } from './adapters/ticket-access.adapter';

@Module({
  providers: [
    PrismaCheckInRepository,
    EventAccessAdapter,
    TicketAccessAdapter,
    { provide: CHECK_IN_REPOSITORY, useExisting: PrismaCheckInRepository },
    { provide: EVENT_ACCESS_FOR_CHECKIN_PORT, useExisting: EventAccessAdapter },
    { provide: TICKET_ACCESS_FOR_CHECKIN_PORT, useExisting: TicketAccessAdapter },
  ],
  exports: [
    CHECK_IN_REPOSITORY,
    EVENT_ACCESS_FOR_CHECKIN_PORT,
    TICKET_ACCESS_FOR_CHECKIN_PORT,
  ],
})
export class CheckInInfrastructureModule {}
