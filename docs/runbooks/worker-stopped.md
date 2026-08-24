# Runbook: Worker Stopped

**Severity:** P2 — Degraded functionality  
**RTO target:** < 5 minutes (container restart)

---

## Workers in this system

| Worker | Module | Responsibility | Init |
|--------|--------|---------------|------|
| `OutboxWorker` | notifications | Sends emails via Resend/SMTP | `OnModuleInit` |
| `OutboxNotificationWorker` | notifications | Processes notification outbox events | `OnModuleInit` |
| `SettlementWorker` | finance | Runs balance settlement on schedule | `OnModuleInit` |
| `ReconciliationWorker` | finance | Reconciles payouts with the provider | `OnModuleInit` |

All workers are initialized by NestJS on module start (`OnModuleInit`). They restart automatically
when the API container restarts.

---

## Symptoms

- **Emails not sent:** users report not receiving confirmation, transfer, or refund emails
- **Settlements delayed:** `balance_settlements` rows missing for events completed > 8 days ago
- **Payouts not reconciled:** payouts in `PROCESSING` state for > 1 hour
- **Outbox accumulating:** [outbox-backlog.md](outbox-backlog.md) alert triggered

---

## Diagnosis

### Step 1 — Check worker heartbeat in logs

```bash
docker logs api --tail=200 | grep -iE "Worker|OnModuleInit|interval|heartbeat"
```

A healthy worker emits a log line on each poll interval.

### Step 2 — Check outbox for stalled events

```sql
SELECT
  event_type,
  COUNT(*) AS pending,
  MIN(created_at) AS oldest
FROM outbox_events
WHERE processed_at IS NULL AND failed_at IS NULL
GROUP BY event_type
ORDER BY pending DESC;
```

If counts are growing and `oldest` is more than 5 minutes ago, the worker is likely stopped.

### Step 3 — Check for unprocessed settlements

```sql
SELECT id, status, created_at
FROM balance_settlements
WHERE created_at < now() - interval '8 days'
  AND status NOT IN ('COMPLETED', 'CANCELLED')
ORDER BY created_at ASC
LIMIT 10;
```

### Step 4 — Check for recurring errors causing worker exit

Workers may crash on repeated exceptions:

```bash
docker logs api --tail=500 | grep -iE "Error|Exception|FATAL" | tail -30
```

---

## Resolution

### Case A — API container is running but worker crashed silently

Restart the API container. NestJS re-runs all `OnModuleInit` hooks on startup:

```bash
docker restart api
```

Verify workers restart:
```bash
docker logs api --tail=50 | grep -iE "Worker|OnModuleInit"
```

### Case B — API container crashed or exited

```bash
docker ps -a | grep api
docker start api
```

### Case C — Worker crashing on every start (repeated exceptions)

1. Identify the error:
   ```bash
   docker logs api --tail=500 | grep -A5 "Error\|Exception"
   ```
2. Common causes:
   - `RESEND_API_KEY` missing or invalid → set correct value and restart
   - Database unreachable → resolve [db-unavailable.md](db-unavailable.md) first
   - External provider rate limit → check provider dashboard

---

## Post-incident

1. If emails were delayed: the outbox retries automatically on restart (idempotent sends via Resend).
2. Check for duplicate sends: Resend and SMTP adapters log `Email sent` — search logs for duplicates by subject + recipient.
3. Add a worker liveness check to the health endpoint if this becomes a recurring issue.
