import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/platform/http/filters/http-exception.filter';

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live → 200 OK', async () => {
    const result = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready → 200 OK', async () => {
    const result = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ status: 'ok' });
  });
});
