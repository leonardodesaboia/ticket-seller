import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';

export interface GetCurrentIdentityInput {
  userId: string;
}

export interface GetCurrentIdentityOutput {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  locale: string;
  timezone: string;
}

@Injectable()
export class GetCurrentIdentityUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetCurrentIdentityInput): Promise<GetCurrentIdentityOutput> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        locale: true,
        timezone: true,
        identities: {
          where: { provider: 'local' },
          select: { emailVerified: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const emailVerified = user.identities[0]?.emailVerified ?? false;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified,
      locale: user.locale,
      timezone: user.timezone,
    };
  }
}
