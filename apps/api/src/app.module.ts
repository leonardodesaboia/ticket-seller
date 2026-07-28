import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './platform/health/health.module';

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
    HealthModule,
  ],
})
export class AppModule {}
