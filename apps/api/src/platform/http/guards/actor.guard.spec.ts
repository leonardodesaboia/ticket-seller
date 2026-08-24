import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ActorGuard } from './actor.guard';
import type { IActorAdapter } from '../actor-adapter.port';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';
import type { PrismaService } from '../../database/prisma.service';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function makePrisma(suspendedAt: Date | null = null): PrismaService {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ suspendedAt }),
    },
  } as unknown as PrismaService;
}

describe('ActorGuard', () => {
  const actor: ICurrentActor = { userId: 'user-abc' };

  it('allows request and attaches actor when adapter resolves', async () => {
    const adapter: IActorAdapter = { resolve: async () => actor };
    const guard = new ActorGuard(adapter, makePrisma());
    const ctx = makeContext({ 'x-dev-user-id': 'user-abc' });

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest()['actor']).toEqual(actor);
  });

  it('throws UnauthorizedException when adapter returns null', async () => {
    const adapter: IActorAdapter = { resolve: async () => null };
    const guard = new ActorGuard(adapter, makePrisma());
    const ctx = makeContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when user is suspended', async () => {
    const adapter: IActorAdapter = { resolve: async () => actor };
    const guard = new ActorGuard(adapter, makePrisma(new Date()));
    const ctx = makeContext({ 'x-dev-user-id': 'user-abc' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
