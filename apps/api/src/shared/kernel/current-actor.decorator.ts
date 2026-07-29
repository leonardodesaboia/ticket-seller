import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ICurrentActor } from './actor.types';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ICurrentActor => {
    return ctx.switchToHttp().getRequest<Record<string, unknown>>()['actor'] as ICurrentActor;
  },
);
