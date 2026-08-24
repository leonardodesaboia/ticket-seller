import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ACTOR_ADAPTER, type IActorAdapter } from '../actor-adapter.port';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    @Inject(ACTOR_ADAPTER) private readonly adapter: IActorAdapter,
    private readonly prisma: PrismaService,
  ) {}

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

    // Check user suspension
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { suspendedAt: true },
    });
    if (user?.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    return true;
  }
}
