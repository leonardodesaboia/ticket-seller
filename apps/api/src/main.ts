import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './platform/http/filters/http-exception.filter';
import { ApplicationErrorFilter } from './platform/http/filters/application-error.filter';
import { setupOtel } from './platform/observability/otel.setup';
import { env } from './platform/config/env';

async function bootstrap(): Promise<void> {
  setupOtel();
  // rawBody: true preserves the raw Buffer on req.rawBody for HMAC-SHA256 webhook verification.
  // bodyLimit: 1MB rejects payloads larger than 1 048 576 bytes before they reach handlers.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1_048_576, trustProxy: 1 }),
    { bufferLogs: true, rawBody: true },
  );

  app.useLogger(app.get(Logger));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const corsOrigins =
    env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((o) => o.trim());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/cors'), {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ApplicationErrorFilter(), new HttpExceptionFilter());

  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ticket Seller API')
      .setDescription('Multi-tenant ticket marketplace API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(env.PORT, '0.0.0.0');
  app.get(Logger).log(`Server listening on http://0.0.0.0:${env.PORT}/api/v1`);
}

bootstrap();
