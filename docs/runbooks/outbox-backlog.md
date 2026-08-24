# Runbook: Outbox Backlog

**Severity:** P2 — Degraded functionality  
**RTO target:** < 30 minutes

---

## What is the outbox?

The outbox pattern ensures that domain events (email notifications, ledger reconciliation triggers)
are persisted atomically with the business operation that produced them. The `outbox_events` table
holds all pending events; workers poll and process them.

---

## Symptoms

- Alert: `outbox_events` has > 1,000 unprocessed rows for more than 10 minutes
- Users not receiving emails (confirmations, transfer invitations, refund notifications)
- `failed_at` count growing in `outbox_events`

---

## Diagnosis

### Step 1 — Count pending events

```sql
SELECT
  event_type,
  COUNT(*) AS pending,
  COUNT(*) FILTER (WHERE failed_at IS NOT NULL) AS failed,
  MIN(created_at) AS oldest_pending
FROM outbox_events
WHERE processed_at IS NULL
GROUP BY event_type
ORDER BY pending DESC;
```

### Step 2 — Identify failed events

```sql
SELECT id, event_type, failed_at, created_at, payload
FROM outbox_events
WHERE failed_at IS NOT NULL AND processed_at IS NULL
ORDER BY failed_at DESC
LIMIT 20;
```

### Step 3 — Check if workers are running

See [worker-stopped.md](worker-stopped.md) — if workers are down, fix that first.

### Step 4 — Check email provider status

```bash
# Test Resend connectivity
curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@example.com","to":["test@example.com"],"subject":"test","text":"test"}' \
  -o /dev/null -w "%{http_code}"
```

Expected: `200`. If `401`: invalid API key. If `429`: rate limit exceeded.

---

## Resolution

### Case A — Workers stopped

See [worker-stopped.md](worker-stopped.md). Restart the API; workers will drain the backlog automatically.

### Case B — Email provider failure (Resend API key invalid or expired)

1. Rotate the `RESEND_API_KEY` in the provider dashboard.
2. Update the environment variable (`.env` or secrets manager).
3. Restart the API container.
4. Workers will retry failed outbox events automatically on next poll.

### Case C — Email provider rate limit

1. Check Resend dashboard for quota usage.
2. Wait for the rate limit window to reset (usually 1 minute).
3. Workers will automatically resume processing.
4. If quota is persistently exhausted: upgrade the Resend plan or implement send-rate throttling in `OutboxWorker`.

### Case D — Stuck failed events (manual retry)

If events have `failed_at` set and will not be retried automatically:

```sql
-- Reset failed_at so workers retry these events.
-- WARNING: this may cause duplicate sends for email events.
-- Only run if you are certain the original sends did not succeed.
UPDATE outbox_events
SET failed_at = NULL
WHERE failed_at IS NOT NULL
  AND processed_at IS NULL
  AND event_type = 'notification.email.v1'; -- scope to one type first
```

Verify no duplicate sends occurred by checking email delivery logs in the Resend dashboard.

---

## Post-incident

1. If the backlog grew due to a provider outage: add monitoring for `failed_at` count per `event_type`.
2. Consider implementing exponential backoff in the outbox worker for transient provider failures.
3. Document how many events were delayed and whether any duplicate sends occurred.
