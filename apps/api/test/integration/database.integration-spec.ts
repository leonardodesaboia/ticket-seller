import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawnSync } from 'child_process';
import { PrismaService } from '../../src/platform/database/prisma.service';
import { DatabaseModule } from '../../src/platform/database/prisma.module';

let container: StartedPostgreSqlContainer;
let prisma: PrismaService;
let testingModule: TestingModule;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;

  const result = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(result.status)}`);
  }

  testingModule = await Test.createTestingModule({
    imports: [DatabaseModule],
  }).compile();

  prisma = testingModule.get(PrismaService);
  await testingModule.init();
}, 120000);

afterAll(async () => {
  await testingModule?.close();
  await container?.stop();
});

describe('PrismaService', () => {
  it('connects to PostgreSQL', async () => {
    const result = await prisma.$queryRaw<[{ one: unknown }]>`SELECT 1 AS one`;
    expect(Number(result[0]?.one)).toBe(1);
  });

  it('can insert and query a user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        displayName: 'Test User',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.locale).toBe('pt-BR');
    expect(user.timezone).toBe('America/Sao_Paulo');
    expect(user.deletedAt).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('enforces unique email constraint', async () => {
    await prisma.user.create({ data: { email: 'unique@example.com' } });
    await expect(prisma.user.create({ data: { email: 'unique@example.com' } })).rejects.toThrow();
    await prisma.user.delete({ where: { email: 'unique@example.com' } });
  });

  it('can insert organization with member', async () => {
    const owner = await prisma.user.create({ data: { email: 'owner@example.com' } });
    const org = await prisma.organization.create({
      data: {
        slug: 'test-org',
        name: 'Test Organization',
        ownerId: owner.id,
      },
    });

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: owner.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    expect(org.slug).toBe('test-org');
    expect(member.role).toBe('OWNER');

    await prisma.organizationMember.delete({ where: { id: member.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: owner.id } });
  });

  it('all 7 tables are accessible', async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.identity.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.organization.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.organizationMember.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.idempotencyRecord.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.outboxEvent.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.auditEntry.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
