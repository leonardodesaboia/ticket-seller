import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { HttpExceptionFilter } from '../../../src/platform/http/filters/http-exception.filter';
import { EMAIL_PROVIDER, IEmailProvider } from '../../../src/modules/notifications/domain/ports/email-provider.port';
import { OutboxNotificationWorker } from '../../../src/modules/notifications/infrastructure/workers/outbox-notification.worker';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;
let worker: OutboxNotificationWorker;
let mockEmailProvider: jest.Mocked<IEmailProvider>;
let sequence = 0;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const databaseUrl = container.getConnectionUri();
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['FAKE_GATEWAY_SECRET'] = 'fake-secret-for-dev';
  process.env['SMTP_HOST'] = 'localhost';
  process.env['SMTP_PORT'] = '1025';
  process.env['SMTP_FROM'] = 'noreply@ticket-seller.local';

  const migration = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' },
  );
  if (migration.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(migration.status)}`);
  }

  mockEmailProvider = { send: jest.fn().mockResolvedValue(undefined) };

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_PROVIDER)
    .useValue(mockEmailProvider)
    .compile();

  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = module.get(PrismaService);
  worker = module.get(OutboxNotificationWorker);
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  if (!prisma) return;
  mockEmailProvider.send.mockClear();

  await prisma.$executeRawUnsafe('DELETE FROM notification_log');
  await prisma.$executeRawUnsafe('DELETE FROM outbox_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_disputes');
  await prisma.$executeRawUnsafe('DELETE FROM refund_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM order_items');
  await prisma.$executeRawUnsafe('DELETE FROM order_pricing_snapshots');
  await prisma.$executeRawUnsafe('DELETE FROM orders');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_inventory');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_types');
  await prisma.$executeRawUnsafe('DELETE FROM events');
  await prisma.$executeRawUnsafe('DELETE FROM organization_members');
  await prisma.$executeRawUnsafe('DELETE FROM organizations');
  await prisma.$executeRawUnsafe('DELETE FROM users');
});

async function createOrg(): Promise<string> {
  const unique = `${Date.now()}-${++sequence}`;
  const user = await prisma.user.create({
    data: { email: `notif-owner-${unique}@test.com`, displayName: 'Notif Owner' },
  });
  const org = await prisma.organization.create({
    data: { name: 'Notif Org', slug: `notif-org-${unique}`, status: 'ACTIVE', ownerId: user.id },
  });
  return org.id;
}

async function insertOutboxEvent(
  orgId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const id = randomUUID();
  const aggregateId = (payload['orderId'] ?? payload['eventId'] ?? 'unknown') as string;
  const aggregateType = type.startsWith('event.') ? 'event' : 'order';
  await prisma.$executeRaw`
    INSERT INTO outbox_events (id, aggregate_type, aggregate_id, type, version, payload, organization_id, occurred_at)
    VALUES (
      ${id}::uuid,
      ${aggregateType},
      ${aggregateId},
      ${type},
      '1',
      ${JSON.stringify(payload)}::jsonb,
      ${orgId}::uuid,
      NOW()
    )
  `;
  return id;
}

type Poll = () => Promise<void>;

interface NotificationLogRow {
  order_id: string | null;
  event_type: string;
  recipient_email: string;
  outbox_event_id: string | null;
}

describe('OutboxNotificationWorker — transactional notifications', () => {
  it('order.cancelled.v1 → sends cancellation email to buyer and records log', async () => {
    const orgId = await createOrg();
    const orderId = randomUUID();

    await insertOutboxEvent(orgId, 'order.cancelled.v1', {
      orderId,
      organizationId: orgId,
      source: 'ADMIN',
      requiresRefund: false,
      reason: 'Evento remarcado',
      buyerEmail: 'buyer@example.com',
    });

    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    expect(mockEmailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Seu pedido foi cancelado' }),
    );

    const logRows = await prisma.$queryRaw<NotificationLogRow[]>`
      SELECT order_id, event_type, recipient_email, outbox_event_id
      FROM notification_log WHERE event_type = 'order.cancelled.v1'
    `;
    expect(logRows).toHaveLength(1);
    expect(logRows[0]!.event_type).toBe('order.cancelled.v1');
  });

  it('order.refunded.v1 → sends refund email with formatted amount', async () => {
    const orgId = await createOrg();
    const orderId = randomUUID();

    await insertOutboxEvent(orgId, 'order.refunded.v1', {
      orderId,
      organizationId: orgId,
      amount: 5000,
      currency: 'BRL',
      externalRefundId: 'refund_abc123',
      buyerEmail: 'buyer@example.com',
    });

    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    const call = mockEmailProvider.send.mock.calls[0]![0];
    expect(call.subject).toBe('Seu reembolso foi processado');
    expect(call.text).toContain('50.00 BRL');

    const logRows = await prisma.$queryRaw<{ event_type: string }[]>`
      SELECT event_type FROM notification_log WHERE event_type = 'order.refunded.v1'
    `;
    expect(logRows).toHaveLength(1);
  });

  it('event.cancelled.v1 → sends admin alert (no orderId) and records via outboxEventId', async () => {
    const orgId = await createOrg();
    const eventId = randomUUID();

    await insertOutboxEvent(orgId, 'event.cancelled.v1', {
      eventId,
      organizationId: orgId,
      reason: 'Força maior',
      ordersCancelledCount: 3,
    });

    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    const call = mockEmailProvider.send.mock.calls[0]![0];
    expect(call.subject).toBe('Evento cancelado — alerta administrativo');
    expect(call.text).toContain('3');

    const logRows = await prisma.$queryRaw<NotificationLogRow[]>`
      SELECT order_id, event_type, outbox_event_id
      FROM notification_log WHERE event_type = 'event.cancelled.v1'
    `;
    expect(logRows).toHaveLength(1);
    expect(logRows[0]!.order_id).toBeNull();
    expect(logRows[0]!.outbox_event_id).not.toBeNull();
  });

  it('order.chargeback.v1 → sends admin alert (not to buyer)', async () => {
    const orgId = await createOrg();
    const orderId = randomUUID();

    await insertOutboxEvent(orgId, 'order.chargeback.v1', {
      orderId,
      organizationId: orgId,
      externalDisputeId: 'dispute_xyz',
    });

    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    const call = mockEmailProvider.send.mock.calls[0]![0];
    expect(call.subject).toBe('Alerta: chargeback recebido');
    expect(call.to).toBe('admin@ticket-seller.local');
    expect(call.text).toContain('dispute_xyz');

    const logRows = await prisma.$queryRaw<{ event_type: string; recipient_email: string }[]>`
      SELECT event_type, recipient_email FROM notification_log WHERE event_type = 'order.chargeback.v1'
    `;
    expect(logRows).toHaveLength(1);
    expect(logRows[0]!.recipient_email).toBe('admin@ticket-seller.local');
  });

  it('idempotency: second poll skips order.cancelled.v1 already in notification_log', async () => {
    const orgId = await createOrg();
    const orderId = randomUUID();

    await insertOutboxEvent(orgId, 'order.cancelled.v1', {
      orderId, organizationId: orgId, source: 'ADMIN', requiresRefund: false, reason: null,
      buyerEmail: 'buyer@example.com',
    });

    await (worker as unknown as { poll: Poll }).poll();
    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);

    // Simulate re-delivery by clearing processed_at
    await prisma.$executeRaw`
      UPDATE outbox_events SET processed_at = NULL WHERE type = 'order.cancelled.v1'
    `;

    mockEmailProvider.send.mockClear();
    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).not.toHaveBeenCalled();
  });

  it('idempotency: second poll skips event.cancelled.v1 via outboxEventId dedup', async () => {
    const orgId = await createOrg();
    const eventId = randomUUID();

    await insertOutboxEvent(orgId, 'event.cancelled.v1', {
      eventId, organizationId: orgId, reason: null, ordersCancelledCount: 0,
    });

    await (worker as unknown as { poll: Poll }).poll();
    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);

    await prisma.$executeRaw`
      UPDATE outbox_events SET processed_at = NULL WHERE type = 'event.cancelled.v1'
    `;

    mockEmailProvider.send.mockClear();
    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).not.toHaveBeenCalled();
  });

  it('processes multiple event types in a single poll', async () => {
    const orgId = await createOrg();

    await insertOutboxEvent(orgId, 'order.cancelled.v1', {
      orderId: randomUUID(), organizationId: orgId, source: 'ADMIN', requiresRefund: false, reason: null,
      buyerEmail: 'buyer1@example.com',
    });
    await insertOutboxEvent(orgId, 'order.refunded.v1', {
      orderId: randomUUID(), organizationId: orgId, amount: 2000, currency: 'BRL', externalRefundId: 'ref_1',
      buyerEmail: 'buyer2@example.com',
    });

    await (worker as unknown as { poll: Poll }).poll();

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(2);

    const logRows = await prisma.$queryRaw<{ event_type: string }[]>`
      SELECT event_type FROM notification_log ORDER BY event_type
    `;
    expect(logRows.map(r => r.event_type).sort()).toEqual([
      'order.cancelled.v1',
      'order.refunded.v1',
    ]);
  });
});
