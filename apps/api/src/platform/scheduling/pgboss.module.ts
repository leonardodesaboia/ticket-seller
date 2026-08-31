import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { env } from '../config/env';

export const PG_BOSS = Symbol('PG_BOSS');

@Global()
@Module({
  providers: [
    {
      provide: PG_BOSS,
      useFactory: async (): Promise<PgBoss> => {
        const logger = new Logger('PgBossModule');
        const boss = new PgBoss({
          connectionString: env.DATABASE_URL,
          schema: 'pgboss',
        });
        boss.on('error', (err: unknown) => {
          logger.error('pg-boss error', err);
        });
        await boss.start();
        return boss;
      },
    },
  ],
  exports: [PG_BOSS],
})
export class PgBossModule implements OnModuleDestroy {
  private readonly logger = new Logger(PgBossModule.name);

  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
    this.logger.log('pg-boss stopped');
  }
}
