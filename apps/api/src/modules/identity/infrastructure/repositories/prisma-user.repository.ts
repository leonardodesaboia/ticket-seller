import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type {
  IdentityWithCredential,
  IUserRepository,
  RegisterUserInput,
  UserProfile,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async emailExists(email: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return row !== null;
  }

  async findUserIdByEmail(email: string): Promise<string | null> {
    const identity = await this.prisma.identity.findFirst({
      where: { provider: 'local', providerUserId: email },
      select: { userId: true },
    });
    return identity?.userId ?? null;
  }

  async findIdentityWithCredential(email: string): Promise<IdentityWithCredential | null> {
    const identity = await this.prisma.identity.findFirst({
      where: {
        provider: 'local',
        providerUserId: email,
        user: { deletedAt: null, suspendedAt: null },
      },
      select: {
        userId: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!identity) return null;

    const credential = await this.prisma.passwordCredential.findUnique({
      where: { userId: identity.userId },
      select: { hash: true },
    });
    if (!credential) return null;

    return {
      userId: identity.userId,
      user: identity.user,
      credentialHash: credential.hash,
    };
  }

  async findProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      timezone: user.timezone,
      emailVerified: user.identities[0]?.emailVerified ?? false,
    };
  }

  async register(input: RegisterUserInput): Promise<{ userId: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, displayName: input.displayName },
          select: { id: true },
        });

        await tx.identity.create({
          data: {
            userId: user.id,
            provider: 'local',
            providerUserId: input.email,
            email: input.email,
            emailVerified: false,
          },
        });

        await tx.passwordCredential.create({
          data: { userId: user.id, hash: input.credentialHash, algorithm: 'argon2id' },
        });

        return { userId: user.id };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }
}
