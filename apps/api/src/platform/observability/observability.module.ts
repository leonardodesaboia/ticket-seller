import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestContextService } from './request-context.service';

@Module({
  providers: [RequestContextService, CorrelationIdMiddleware],
  exports: [RequestContextService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '(.*)', method: RequestMethod.ALL });
  }
}
