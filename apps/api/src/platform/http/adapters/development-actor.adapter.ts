import { Injectable } from '@nestjs/common';
import type { IActorAdapter } from '../actor-adapter.port';
import type { ICurrentActor } from '../../../shared/kernel/actor.types';

@Injectable()
export class DevelopmentActorAdapter implements IActorAdapter {
  async resolve(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ICurrentActor | null> {
    if (process.env['NODE_ENV'] === 'production') {
      return null;
    }
    const userId = request.headers['x-dev-user-id'];
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return null;
    }
    return { userId: userId.trim() };
  }
}
