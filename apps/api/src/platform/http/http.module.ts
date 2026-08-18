import { Module } from '@nestjs/common';
import { IdentityModule } from '../../modules/identity/identity.module';

/**
 * HttpModule provides cross-cutting HTTP infrastructure.
 * ACTOR_ADAPTER and ActorGuard are owned by IdentityModule and re-exported here
 * so that the rest of the application can depend on HttpModule as before.
 */
@Module({
  imports: [IdentityModule],
  exports: [IdentityModule],
})
export class HttpModule {}

