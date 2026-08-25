import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/platform/http/filters/http-exception.filter';
import { PrismaService } from '../../src/platform/database/prisma.service';
import { OBJECT_STORAGE_PORT } from '../../src/shared/ports/object-storage.port';

const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockResolvedValue([{ one: 1n }]),
};

const mockObjectStorageAdapter = {
  generateUploadUrl: jest.fn().mockResolvedValue('https://mock-upload-url'),
  generateDownloadUrl: jest.fn().mockResolvedValue('https://mock-download-url'),
  headObject: jest.fn().mockResolvedValue(null),
  deleteObject: jest.fn().mockResolvedValue(undefined),
};

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(OBJECT_STORAGE_PORT)
      .useValue(mockObjectStorageAdapter)
      .compile();

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

  it('GET /api/v1/health/ready → 200 OK when DB reachable', async () => {
    mockPrismaService.$queryRaw.mockResolvedValueOnce([{ one: 1n }]);
    const result = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready → 503 when DB unreachable', async () => {
    mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const result = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(result.statusCode).toBe(503);
  });
});
