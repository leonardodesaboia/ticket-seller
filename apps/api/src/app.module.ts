import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './platform/database/prisma.module';
import { HealthModule } from './platform/health/health.module';
import { HttpModule } from './platform/http/http.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { EventsModule } from './modules/events/events.module';
import { VenuesModule } from './modules/venues/venues.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReservationsModule } from './modules/reservations/reservations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'test' ? 'silent' : (process.env['LOG_LEVEL'] ?? 'info'),
        ...(process.env['NODE_ENV'] === 'development' && {
          transport: { target: 'pino-pretty', options: { singleLine: true } },
        }),
      },
    }),
    DatabaseModule,
    HealthModule,
    HttpModule,
    OrganizationsModule,
    EventsModule,
    VenuesModule,
    InventoryModule,
    ReservationsModule,
  ],
})
export class AppModule {}
