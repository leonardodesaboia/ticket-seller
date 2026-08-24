/**
 * Integration tests for the Financial Ledger (TASK-048).
 *
 * Scenarios covered:
 * 1. ORDER_PAID: ledger entries are created correctly, sum(DEBIT) = sum(CREDIT).
 * 2. Duplicate ORDER_PAID event: idempotent — only one set of entries.
 * 3. REFUND (RETAIN policy): ledger entries are correct.
 * 4. CHARGEBACK: ledger entries debit SELLER_PAYABLE and credit PLATFORM_CLEARING.
 */
import * as crypto from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import supertest from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { HttpExceptionFilter } from '../../../src/platform/http/filters/http-exception.filter';

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;
let sequence = 0;

function signFakeWebhook(body: Buffer, secret = 'fake-secret-for-dev'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildWebhookBody(
  externalPaymentId: string,
  eventType: string,
  amount: number,
  currency = 'BRL',
  eventId = randomUUID(),
): Buffer {
  return Buffer.from(
    JSON.stringify({ eventId, externalPaymentId, eventType, amount, currency }),
    'utf8',
  );
}

function sendWebhook(body: Buffer, signature: string) {
  return supertest(app.getHttpServer())
    .post('/api/v1/webhooks/payments/fake')
    .type('json')
    .set('x-fake-signature', signature)
    .send(body.toString('utf8'));
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = container.getConnectionUri();
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['FAKE_GATEWAY_SECRET'] = 'fake-secret-for-dev';

  const migration = spawnSync(
    'pnpm',
    ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' },
  );
  if (migration.status !== 0) {
    throw new Error(`prisma migrate deploy failed with status ${String(migration.status)}`);
  }

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
}, 120000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

afterEach(async () => {
  if (!prisma) return;
  // Clean in dependency order
  await prisma.$executeRawUnsafe('DELETE FROM payout_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payouts');
  await prisma.$executeRawUnsafe('DELETE FROM payout_recipients');
  await prisma.$executeRawUnsafe('DELETE FROM balance_settlements');
  await prisma.$executeRawUnsafe('DELETE FROM seller_balances');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_entries');
  await prisma.$executeRawUnsafe('DELETE FROM ledger_transactions');
  // Remove org-scoped ledger accounts (keep platform accounts)
  await prisma.$executeRawUnsafe(
    "DELETE FROM ledger_accounts WHERE organization_id IS NOT NULL",
  );
  await prisma.$executeRawUnsafe('DELETE FROM payment_disputes');
  await prisma.$executeRawUnsafe('DELETE FROM refund_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM payment_webhook_events');
  await prisma.$executeRawUnsafe('DELETE FROM payment_attempts');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_credentials');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM order_pricing_snapshots');
  await prisma.$executeRawUnsafe('DELETE FROM order_items');
  await prisma.$executeRawUnsafe('DELETE FROM orders');
  await prisma.$executeRawUnsafe('DELETE FROM reservation_items');
  await prisma.$executeRawUnsafe('DELETE FROM reservations');
  await prisma.$executeRawUnsafe('DELETE FROM ticket_inventory');
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

interface LedgerFixture {
  organizationId: string;
  ownerId: string;
  orderId: string;
  externalPaymentId: string;
  attemptAmount: number;
  reservationToken: string;
}

async function createFixture(): Promise<LedgerFixture> {
  const unique = `${Date.now()}-${++sequence}`;

  const owner = await prisma.user.create({
    data: { email: `ledger-${unique}@test.com`, displayName: 'Ledger Owner' },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'Ledger Org',
      slug: `ledger-org-${unique}`,
      status: 'ACTIVE',
      ownerId: owner.id,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      title: 'Ledger Event',
      status: 'PUBLISHED',
      slug: `ledger-event-${unique}`,
      currency: 'BRL',
      publishedAt: new Date(),
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      name: 'General',
      priceAmount: 10000, // R$100.00 each
      capacity: 10,
      eventId: event.id,
      organizationId: organization.id,
      status: 'ACTIVE',
    },
  });
  await prisma.ticketInventory.create({
    data: {
      ticketTypeId: ticketType.id,
      eventId: event.id,
      organizationId: organization.id,
      capacity: 10,
    },
  });

  // Create reservation
  const reservationRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/reservations')
    .set('Idempotency-Key', randomUUID())
    .send({ eventSlug: event.slug, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] })
    .expect(201);

  const reservationToken: string = reservationRes.body.token as string;
  const reservationId: string = reservationRes.body.reservationId as string;

  // Create order
  const orderRes = await supertest(app.getHttpServer())
    .post('/api/v1/public/orders')
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ reservationId })
    .expect(201);

  const orderId: string = orderRes.body.orderId as string;

  // Create payment attempt
  const paymentRes = await supertest(app.getHttpServer())
    .post(`/api/v1/public/orders/${orderId}/payments`)
    .set('X-Reservation-Token', reservationToken)
    .set('Idempotency-Key', randomUUID())
    .send({ paymentMethod: 'FAKE_PIX' })
    .expect(201);

  const paymentAttemptId: string = paymentRes.body.paymentAttemptId as string;

  const attemptRows = await prisma.$queryRaw<Array<{ external_payment_id: string; amount: bigint }>>`
    SELECT external_payment_id, amount FROM payment_attempts WHERE id = ${paymentAttemptId}::uuid
  `;
  const externalPaymentId = attemptRows[0]!.external_payment_id;
  const attemptAmount = Number(attemptRows[0]!.amount);

  return {
    organizationId: organization.id,
    ownerId: owner.id,
    orderId,
    externalPaymentId,
    attemptAmount,
    reservationToken,
  };
}

async function triggerApproval(fixture: LedgerFixture, eventId = randomUUID()): Promise<void> {
  const body = buildWebhookBody(
    fixture.externalPaymentId,
    'PAYMENT_APPROVED',
    fixture.attemptAmount,
    'BRL',
    eventId,
  );
  const sig = signFakeWebhook(body);
  await sendWebhook(body, sig).expect(200);
}

describe('Financial Ledger — ORDER_PAID', () => {
  it('creates ledger entries with correct accounts and sum(DEBIT) = sum(CREDIT)', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    // Verify transaction was created
    const txRows = await prisma.$queryRaw<
      Array<{ id: string; source_type: string; source_id: string }>
    >`
      SELECT id, source_type, source_id
      FROM ledger_transactions
      WHERE source_type = 'ORDER_PAID'
        AND source_id = ${fixture.orderId}
    `;
    expect(txRows).toHaveLength(1);
    const ledgerTxId = txRows[0]!.id;

    // Verify entries
    const entries = await prisma.$queryRaw<
      Array<{ entry_type: string; amount: bigint; account_code: string }>
    >`
      SELECT le.entry_type, le.amount, la.code AS account_code
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.ledger_transaction_id = ${ledgerTxId}::uuid
      ORDER BY le.entry_type, la.code
    `;

    // Should have at least 2 entries: DEBIT PLATFORM_CLEARING + CREDIT SELLER_PAYABLE
    // (platformFeeAmount is 0 for the default policy, so PLATFORM_REVENUE entry is omitted)
    expect(entries.length).toBeGreaterThanOrEqual(2);

    // Sum DEBIT must equal Sum CREDIT
    const debitSum = entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    const creditSum = entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    expect(debitSum).toBe(creditSum);

    // PLATFORM_CLEARING should be debited with the gross amount
    const clearingDebit = entries.find(
      (e) => e.account_code === 'PLATFORM_CLEARING' && e.entry_type === 'DEBIT',
    );
    expect(clearingDebit).toBeDefined();
    expect(BigInt(clearingDebit!.amount)).toBe(BigInt(fixture.attemptAmount));

    // SELLER_PAYABLE account should be credited
    const sellerCredit = entries.find(
      (e) =>
        e.account_code.startsWith('SELLER_PAYABLE:') && e.entry_type === 'CREDIT',
    );
    expect(sellerCredit).toBeDefined();
  });

  it('creates pricing snapshot linked to the ledger transaction for order', async () => {
    const fixture = await createFixture();
    await triggerApproval(fixture);

    const snapshots = await prisma.$queryRaw<Array<{ order_id: string; gross_amount: bigint }>>`
      SELECT order_id, gross_amount FROM order_pricing_snapshots WHERE order_id = ${fixture.orderId}::uuid
    `;
    expect(snapshots).toHaveLength(1);
    expect(BigInt(snapshots[0]!.gross_amount)).toBe(BigInt(fixture.attemptAmount));
  });
});

describe('Financial Ledger — Idempotency (duplicate ORDER_PAID)', () => {
  it('processes duplicate webhook exactly once — single ledger transaction and entries', async () => {
    const fixture = await createFixture();
    const eventId = randomUUID();

    // Fire the same webhook twice
    await triggerApproval(fixture, eventId);
    await triggerApproval(fixture, eventId);

    // Should have exactly one ledger_transaction for this order
    const txRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM ledger_transactions
      WHERE source_type = 'ORDER_PAID'
        AND source_id = ${fixture.orderId}
    `;
    expect(Number(txRows[0]!.count)).toBe(1);

    // Retrieve transaction id
    const txDetail = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM ledger_transactions WHERE source_type = 'ORDER_PAID' AND source_id = ${fixture.orderId}
    `;
    const ledgerTxId = txDetail[0]!.id;

    // Should have the expected number of entries (not doubled)
    const entryRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM ledger_entries WHERE ledger_transaction_id = ${ledgerTxId}::uuid
    `;
    // default policy has 0 bps fee, so only 2 entries: DEBIT + CREDIT SELLER_PAYABLE
    expect(Number(entryRows[0]!.count)).toBe(2);
  });
});

describe('Financial Ledger — REFUND (RETAIN policy)', () => {
  it('creates refund ledger entries: DEBIT SELLER_PAYABLE, CREDIT PLATFORM_CLEARING', async () => {
    const fixture = await createFixture();

    // First approve the payment to create snapshot + ledger entries
    await triggerApproval(fixture);

    // Cancel order via admin API
    await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/orders/${fixture.orderId}/cancellations`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .send({ reason: 'Test refund' })
      .expect(200);

    // Trigger refund via API
    const refundRes = await supertest(app.getHttpServer())
      .post(`/api/v1/organizations/${fixture.organizationId}/orders/${fixture.orderId}/refunds`)
      .set('X-Dev-User-Id', fixture.ownerId)
      .expect(200);

    expect(refundRes.body.status).toBe('REFUNDED');

    // Verify refund ledger transaction
    const txRows = await prisma.$queryRaw<
      Array<{ id: string; source_type: string; source_id: string }>
    >`
      SELECT id, source_type, source_id
      FROM ledger_transactions
      WHERE source_type = 'REFUND'
        AND source_id = ${fixture.orderId}
    `;
    expect(txRows).toHaveLength(1);
    const refundTxId = txRows[0]!.id;

    const entries = await prisma.$queryRaw<
      Array<{ entry_type: string; amount: bigint; account_code: string }>
    >`
      SELECT le.entry_type, le.amount, la.code AS account_code
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.ledger_transaction_id = ${refundTxId}::uuid
    `;

    // sum(DEBIT) must equal sum(CREDIT)
    const debitSum = entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    const creditSum = entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    expect(debitSum).toBe(creditSum);

    // DEBIT should be on SELLER_PAYABLE
    const debitEntry = entries.find(
      (e) => e.entry_type === 'DEBIT' && e.account_code.startsWith('SELLER_PAYABLE:'),
    );
    expect(debitEntry).toBeDefined();

    // CREDIT should be on PLATFORM_CLEARING
    const creditEntry = entries.find(
      (e) => e.entry_type === 'CREDIT' && e.account_code === 'PLATFORM_CLEARING',
    );
    expect(creditEntry).toBeDefined();
  });
});

describe('Financial Ledger — CHARGEBACK', () => {
  it('creates chargeback ledger entries: DEBIT SELLER_PAYABLE, CREDIT PLATFORM_CLEARING', async () => {
    const fixture = await createFixture();

    // Approve first to issue tickets
    await triggerApproval(fixture);

    // Now trigger a chargeback webhook
    const disputeEventId = randomUUID();
    const chargebackBody = buildWebhookBody(
      fixture.externalPaymentId,
      'PAYMENT_DISPUTED',
      fixture.attemptAmount,
      'BRL',
      disputeEventId,
    );
    const sig = signFakeWebhook(chargebackBody);
    await sendWebhook(chargebackBody, sig).expect(200);

    // Verify chargeback ledger transaction
    const txRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM ledger_transactions
      WHERE source_type = 'CHARGEBACK'
        AND source_id = ${fixture.orderId}
    `;
    expect(txRows).toHaveLength(1);
    const chargebackTxId = txRows[0]!.id;

    const entries = await prisma.$queryRaw<
      Array<{ entry_type: string; amount: bigint; account_code: string }>
    >`
      SELECT le.entry_type, le.amount, la.code AS account_code
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.ledger_transaction_id = ${chargebackTxId}::uuid
    `;

    // Exactly 2 entries: DEBIT SELLER_PAYABLE, CREDIT PLATFORM_CLEARING
    expect(entries).toHaveLength(2);

    const debitSum = entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    const creditSum = entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((acc, e) => acc + BigInt(e.amount), 0n);
    expect(debitSum).toBe(creditSum);

    const debitEntry = entries.find(
      (e) => e.entry_type === 'DEBIT' && e.account_code.startsWith('SELLER_PAYABLE:'),
    );
    expect(debitEntry).toBeDefined();

    const creditEntry = entries.find(
      (e) => e.entry_type === 'CREDIT' && e.account_code === 'PLATFORM_CLEARING',
    );
    expect(creditEntry).toBeDefined();

    // Amount should equal the chargeback amount
    expect(BigInt(debitEntry!.amount)).toBe(BigInt(fixture.attemptAmount));
    expect(BigInt(creditEntry!.amount)).toBe(BigInt(fixture.attemptAmount));
  });
});
