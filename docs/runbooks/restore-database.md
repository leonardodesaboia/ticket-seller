# Runbook: Restore Database

**Severity:** P0 — Data loss or corruption  
**RTO target:** < 2 hours  
**Escalation:** Notify all stakeholders before starting. Document everything.

---

## When to use this runbook

- Database corruption confirmed (checksums fail, tables unreadable)
- Accidental deletion of critical data that cannot be recovered from application state
- Ransomware or unauthorized modification of data
- Disaster recovery drill (monthly — see [backup-strategy.md](../operations/backup-strategy.md))

**Do not use this runbook for a database that is simply unreachable.** See [db-unavailable.md](db-unavailable.md) first.

---

## Pre-restore checklist

- [ ] Root cause identified (or investigation in parallel)
- [ ] Stakeholders notified of extended outage
- [ ] Backup file identified and its timestamp documented
- [ ] Restore target (new DB or same DB) decided
- [ ] `DATABASE_URL` for the restore target available
- [ ] Sufficient disk space confirmed: `df -h` on the restore host

---

## Step 1 — Stop the API to prevent writes

```bash
docker stop api api-migrate
```

Confirm no active connections are writing to the database:
```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND application_name != 'psql';
```

---

## Step 2 — Identify the backup to restore

List available backups in the storage bucket:

```bash
# S3
aws s3 ls s3://<backup-bucket>/postgres-backups/ --recursive | sort | tail -20

# MinIO
mc ls myminio/<backup-bucket>/postgres-backups/ | sort | tail -20
```

Choose the most recent backup **before** the incident. Document the backup filename and timestamp.

---

## Step 3 — Download the backup

```bash
# S3
aws s3 cp s3://<backup-bucket>/postgres-backups/<filename>.dump /tmp/restore.dump

# MinIO
mc cp myminio/<backup-bucket>/postgres-backups/<filename>.dump /tmp/restore.dump
```

Verify checksum if available:
```bash
sha256sum /tmp/restore.dump
# Compare with the .sha256 file in the bucket if stored
```

---

## Step 4 — Create the restore target database

**Option A — Restore to a new database (safer, allows validation before cutover):**

```bash
createdb -U postgres ticket_seller_restore
pg_restore -U postgres -d ticket_seller_restore /tmp/restore.dump
```

**Option B — Restore in-place (faster, for disaster recovery):**

```bash
dropdb -U postgres ticket_seller --if-exists
createdb -U postgres ticket_seller
pg_restore -U postgres -d ticket_seller /tmp/restore.dump
```

---

## Step 5 — Validate the restore

Run all validation queries against the restored database:

```sql
-- Migration history
SELECT migration_name, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 10;

-- Row counts (compare with pre-incident values if known)
SELECT 'orders' AS tbl, COUNT(*) FROM orders
UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries
UNION ALL SELECT 'payouts', COUNT(*) FROM payouts
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'users', COUNT(*) FROM users;

-- Ledger integrity: credits = debits for each account
SELECT account_id, SUM(amount_minor) AS balance
FROM ledger_entries
GROUP BY account_id
HAVING SUM(amount_minor) < 0  -- should return 0 rows (no negative balances for standard accounts)
LIMIT 5;

-- No orphaned confirmed orders without tickets
SELECT o.id
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
WHERE o.status = 'CONFIRMED' AND t.id IS NULL
LIMIT 5;
```

All queries should return expected results. If validation fails, do not proceed — escalate.

---

## Step 6 — Apply any migrations missed since the backup

If the backup predates the most recent migration:

```bash
DATABASE_URL="postgresql://...ticket_seller_restore..." \
  npx prisma migrate deploy
```

Confirm all migrations applied:
```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
```

---

## Step 7 — Cut over to the restored database

**If restored to a new DB (Option A):** update `DATABASE_URL` in the environment to point to
`ticket_seller_restore`, or rename:

```bash
psql -U postgres -c "ALTER DATABASE ticket_seller RENAME TO ticket_seller_old;"
psql -U postgres -c "ALTER DATABASE ticket_seller_restore RENAME TO ticket_seller;"
```

---

## Step 8 — Restart the API

```bash
docker start api
```

Check the health endpoint:
```bash
curl -s http://localhost:3000/api/v1/health/ready | jq .
```

Expected: `{"status":"ok"}`.

---

## Step 9 — Smoke test

1. `GET /api/v1/health/live` → 200
2. `GET /api/v1/health/ready` → 200
3. Login with a known account
4. List events: `GET /api/v1/events`
5. Verify at least one confirmed order has its tickets

---

## Step 10 — Document the incident

Record in the incident log:
- Date and time of the incident
- Date and time of the restore backup (data window lost)
- Data loss estimate: events between backup timestamp and incident
- Restore start and completion time
- Operator name
- Validation results
- Follow-up items (monitoring, alerts, root cause fix)

---

## Post-incident

1. Keep `ticket_seller_old` (if Option A) for 72 hours before dropping, in case of questions.
2. Identify whether the root cause can trigger the same incident again.
3. If the backup was older than expected: investigate why more recent backups were not taken.
4. Schedule a restore drill within 30 days to verify the new backup configuration.
