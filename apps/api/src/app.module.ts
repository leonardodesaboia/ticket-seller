import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { SmartThrottlerGuard } from './platform/http/guards/smart-throttler.guard';
import { ObservabilityModule } from './platform/observability/observability.module';
import { requestContextStorage } from './platform/observability/request-context';
import { DatabaseModule } from './platform/database/prisma.module';
import { HealthModule } from './platform/health/health.module';
import { PgBossModule } from './platform/scheduling/pgboss.module';
import { HttpModule } from './platform/http/http.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { EventsModule } from './modules/events/events.module';
import { VenuesModule } from './modules/venues/venues.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CheckInModule } from './modules/checkin/checkin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env['REDIS_URL'];
        return {
          throttlers: [{ name: 'global', ttl: 60_000, limit: 200 }],
          ...(redisUrl ? { storage: new ThrottlerStorageRedisService(redisUrl) } : {}),
        };
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'test' ? 'silent' : (process.env['LOG_LEVEL'] ?? 'info'),
        genReqId: () => requestContextStorage.getStore()?.requestId ?? randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-dev-user-id"]',
            '*.password',
            '*.tokenHash',
            '*.token_hash',
            '*.hash',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req: IncomingMessage & { id?: string }) => ({
            requestId: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
        customSuccessMessage: (req: IncomingMessage, res: ServerResponse, elapsed: number) =>
          `${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} ${res.statusCode} ${elapsed}ms`,
        ...(process.env['NODE_ENV'] === 'development' && {
          transport: { target: 'pino-pretty', options: { singleLine: true } },
        }),
      },
    }),
    ObservabilityModule,
    DatabaseModule,
    PgBossModule,
    HealthModule,
    HttpModule,
    IdentityModule,
    OrganizationsModule,
    EventsModule,
    VenuesModule,
    InventoryModule,
    ReservationsModule,
    OrdersModule,
    PaymentsModule,
    TicketsModule,
    CheckInModule,
    NotificationsModule,
    PlatformAdminModule,
    MediaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SmartThrottlerGuard }],
})
export class AppModule {}
