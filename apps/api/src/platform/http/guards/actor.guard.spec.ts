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

  it('allows request and attaches actor when adapter resolves', () => {
    const adapter: IActorAdapter = { resolve: () => actor };
    const guard = new ActorGuard(adapter);
    const ctx = makeContext({ 'x-dev-user-id': 'user-abc' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest()['actor']).toEqual(actor);
  });

  it('throws UnauthorizedException when adapter returns null', () => {
    const adapter: IActorAdapter = { resolve: () => null };
    const guard = new ActorGuard(adapter);
    const ctx = makeContext();

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
