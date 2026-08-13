import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './platform/http/filters/http-exception.filter';
import { env } from './platform/config/env';

async function bootstrap(): Promise<void> {
  // rawBody: true instructs the FastifyAdapter to preserve the raw Buffer on req.rawBody
  // for all requests. This is required for HMAC-SHA256 webhook signature verification.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));

  await app.register(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@fastify/cors'),
    { origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',') },
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/helmet'));

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ticket Seller API')
    .setDescription('Multi-tenant ticket marketplace API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(env.PORT, '0.0.0.0');
  app.get(Logger).log(`Server listening on http://0.0.0.0:${env.PORT}/api/v1`);
}

bootstrap();
