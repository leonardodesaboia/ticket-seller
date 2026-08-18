import type { ICurrentActor } from '../../shared/kernel/actor.types';

export const ACTOR_ADAPTER = Symbol('ACTOR_ADAPTER');

export interface IActorAdapter {
  resolve(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ICurrentActor | null>;
}
