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
    // Count by email AND by ip independently, then take the max.
    // Counting both together (email AND ip) would allow an attacker to bypass
    // per-email limits by rotating IPs, or bypass per-IP limits by rotating emails.
    const [byEmail, byIp] = await Promise.all([
      this.prisma.authenticationAttempt.count({
        where: { email, outcome: 'FAILURE', attemptedAt: { gte: since } },
      }),
      this.prisma.authenticationAttempt.count({
        where: { ip, outcome: 'FAILURE', attemptedAt: { gte: since } },
      }),
    ]);
    return Math.max(byEmail, byIp);
  }
}
