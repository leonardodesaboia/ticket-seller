import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { THROTTLE_USE_EMAIL_KEY } from '../decorators/throttle.decorator';

@Injectable()
export class SmartThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const useEmailKey = this.reflector.getAllAndOverride<boolean>(THROTTLE_USE_EMAIL_KEY, [
      requestProps.context.getHandler(),
      requestProps.context.getClass(),
    ]);

    if (useEmailKey) {
      const { req } = this.getRequestResponse(requestProps.context);
      const body = req['body'] as Record<string, unknown> | undefined;
      const email = (body?.['email'] as string | undefined) ?? '';
      const ip = (req['ip'] as string | undefined) ?? '0.0.0.0';
      const originalGetTracker = requestProps.getTracker;
      requestProps = {
        ...requestProps,
        getTracker: async (r, ctx) => `${await originalGetTracker(r, ctx)}-${ip}-${email}`,
      };
    }

    return super.handleRequest(requestProps);
  }
}
