import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { IAuthAttemptRepository, RecordAttemptInput } from '../../domain/ports/auth-attempt.repository.port';

@Injectable()
export class PrismaAuthAttemptRepository implements IAuthAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAttemptInput): Promise<void> {
    await this.prisma.authenticationAttempt.create({
      data: {
        email: input.email,
        ip: input.ip,
        outcome: input.outcome,
      },
    });
  }

  async countRecentFailures(email: string, ip: string, sinceMinutes: number): Promise<number> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const count = await this.prisma.authenticationAttempt.count({
      where: {
        email,
        ip,
        outcome: 'FAILURE',
        attemptedAt: { gte: since },
      },
    });
    return count;
  }
}
