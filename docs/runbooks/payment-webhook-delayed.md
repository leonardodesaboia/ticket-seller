# Runbook: Payment Webhook Delayed

**Severity:** P2 — Degraded functionality (customer-facing)  
**RTO target:** < 1 hour

---

## Background

The payment flow is:
1. Buyer submits payment → PSP processes → PSP sends webhook `ORDER_PAID` to `/api/v1/payments/webhook`
2. API verifies HMAC signature → updates order to `PAID` → issues tickets → sends confirmation email

If the webhook is delayed or lost, the order stays in `PROCESSING` status. The buyer has paid
but has no tickets, and receives no confirmation email.

---

## Symptoms

- Order in `PROCESSING` status for more than 30 minutes after PSP payment confirmation
- Buyer reports payment charged but no ticket received
- PSP dashboard shows payment as `succeeded` / `approved`

---

## Diagnosis

### Step 1 — Identify stuck orders

```sql
SELECT
  id,
  status,
  created_at,
  now() - created_at AS age
FROM orders
WHERE status = 'PROCESSING'
  AND created_at < now() - interval '30 minutes'
ORDER BY created_at ASC;
```

### Step 2 — Check outbox for ORDER_PAID events

```sql
SELECT id, event_type, processed_at, failed_at, created_at
FROM outbox_events
WHERE event_type = 'order.paid.v1'
ORDER BY created_at DESC
LIMIT 20;
```

If no `order.paid.v1` event exists for the order's creation window, the webhook was never received.

### Step 3 — Check webhook delivery logs

```bash
docker logs api --tail=500 | grep -iE "webhook|payment|signature"
```

Look for: incoming webhook requests, HMAC validation failures, or processing errors.

### Step 4 — Check PSP dashboard

In the PSP (FakePaymentGateway or real provider) dashboard:
- Confirm the payment status (should be `succeeded`)
- Check webhook delivery history for the order's `payment_intent_id` or equivalent
- Look for delivery failures (non-2xx responses from our endpoint)

---

## Resolution

### Case A — Webhook was never sent by the PSP

Request a manual webhook replay from the PSP dashboard.

For FakePaymentGateway: call the internal callback endpoint manually or update the fake order
state to trigger re-delivery.

### Case B — Webhook was sent but our endpoint returned an error

1. Check logs for the error at the time of the webhook:
   ```bash
   docker logs api | grep -A10 "webhook"
   ```
2. If the endpoint was unavailable (deploy in progress, OOM restart): request PSP to replay.
3. If the HMAC validation failed: verify `FAKE_PAYOUT_SECRET` (or real PSP secret) matches
   what is configured in the PSP dashboard.

### Case C — Webhook received and processed, but order not updated

Check for a failed outbox event:
```sql
SELECT * FROM outbox_events
WHERE event_type = 'order.paid.v1' AND failed_at IS NOT NULL;
```

If found, see [outbox-backlog.md](outbox-backlog.md) for retry procedure.

### Case D — Manual order resolution (last resort)

Only after exhausting the above options and confirming payment via the PSP:

```sql
-- First: verify payment is confirmed in PSP dashboard.
-- Then, as a last resort, use the admin API or a migration script — never raw SQL on orders.
-- Document with an AuditEntry: reason, operator, timestamp, PSP reference.
```

**Do not update order status directly in the database without an audit trail.**

---

## Post-incident

1. Confirm the buyer received their tickets (email + check `tickets` table for the order).
2. If HMAC validation was the cause: rotate the webhook secret in both the PSP dashboard and
   the `FAKE_PAYOUT_SECRET` environment variable simultaneously to avoid a gap.
3. Consider adding a reconciliation job that checks for `PROCESSING` orders older than 30 minutes
   and alerts the team (future enhancement).
