import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ActorGuard } from './actor.guard';
import type { IActorAdapter } from '../actor-adapter.port';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ActorGuard', () => {
  const actor: ICurrentActor = { userId: 'user-abc' };

  it('allows request and attaches actor when adapter resolves', async () => {
    const adapter: IActorAdapter = { resolve: async () => actor };
    const guard = new ActorGuard(adapter);
    const ctx = makeContext({ 'x-dev-user-id': 'user-abc' });

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest()['actor']).toEqual(actor);
  });

  it('throws UnauthorizedException when adapter returns null', async () => {
    const adapter: IActorAdapter = { resolve: async () => null };
    const guard = new ActorGuard(adapter);
    const ctx = makeContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
