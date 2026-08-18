import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ACTOR_ADAPTER, type IActorAdapter } from '../actor-adapter.port';

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(@Inject(ACTOR_ADAPTER) private readonly adapter: IActorAdapter) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Record<string, unknown> & { headers: Record<string, string | string[] | undefined> }
      >();
    const actor = await this.adapter.resolve(request);
    if (!actor) {
      throw new UnauthorizedException('Authentication required');
    }
    request['actor'] = actor;
    return true;
  }
}
