import { Module } from '@nestjs/common';
import { ACTOR_ADAPTER } from './actor-adapter.port';
import { DevelopmentActorAdapter } from './adapters/development-actor.adapter';
import { ActorGuard } from './guards/actor.guard';

@Module({
  providers: [
    {
      provide: ACTOR_ADAPTER,
      useClass: DevelopmentActorAdapter,
    },
    ActorGuard,
  ],
  exports: [ActorGuard, ACTOR_ADAPTER],
})
export class HttpModule {}
