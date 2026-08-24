# Backup Strategy

## Scope

This document covers the backup strategy for all stateful components of the ticket-seller platform:
PostgreSQL (primary data store), object storage (media files), and Redis (ephemeral cache).

---

## PostgreSQL

### Frequency and Retention

| Backup type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full dump | Every 6 hours | 30 days | Separate S3 bucket / object storage |
| Point-in-Time Recovery (PiTR) | Continuous WAL archiving (managed PostgreSQL) | 7 days | Provider-managed |

For self-hosted setups without managed PostgreSQL, use `pg_dump` with a cron job:

```bash
# /etc/cron.d/postgres-backup
0 */6 * * * postgres pg_dump -Fc $DATABASE_URL > /backups/ticket_seller_$(date +%Y%m%dT%H%M).dump
```

### Retention policy

Backups older than 30 days are deleted automatically. The S3 lifecycle rule handles this:

```json
{
  "Rules": [{
    "Status": "Enabled",
    "Filter": {"Prefix": "postgres-backups/"},
    "Expiration": {"Days": 30}
  }]
}
```

### Encryption

- Backups are encrypted at rest using AES-256 (S3 server-side encryption or gpg for self-hosted).
- Encryption keys are stored separately from application credentials (never in `.env` or alongside backups).

### Restore test

Monthly restore drill in an isolated sandbox:
1. Download the most recent backup from the storage bucket.
2. Restore to a temporary database: `pg_restore -d ticket_seller_sandbox < backup.dump`.
3. Verify 10 random records from each critical table: `orders`, `ledger_entries`, `payouts`, `tickets`.
4. Confirm migration history matches production: `SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`.
5. Document results in an audit log entry.

---

## Object Storage (MinIO / S3)

Media files (event images, ticket PDFs) are not the source of truth for transactional data.
Losing an uploaded image means a broken image link, not a lost transaction.

### Strategy

| Mechanism | When to use |
|-----------|-------------|
| Bucket versioning | Always — prevents accidental overwrites and deletions |
| Cross-region replication | If budget allows; otherwise use daily snapshots |
| Daily volume snapshot | Self-hosted MinIO — snapshot the underlying data volume |

### Restore

For individual file recovery: restore from a versioned bucket using the AWS CLI or MinIO client.
For full storage restore: restore the volume snapshot to a new instance.

---

## Redis

Redis holds only rate-limiting counters and cached session data (see TASK-057).

**RPO = 0 is acceptable** — all rate-limiting state is ephemeral, and sessions re-authenticate
automatically. No backup is needed for the MVP.

If Redis becomes unavailable, the API falls back to in-memory throttling (degraded multi-instance
behavior) and users must re-authenticate.

---

## RPO / RTO Summary

| Scenario | RPO | RTO | Impact |
|----------|-----|-----|--------|
| API process failure | 0 (stateless) | < 5 min (container restart) | In-flight requests lost |
| Worker failure | 0 (outbox persists) | < 5 min (restart) | Email/reconciliation delay |
| Database instance failure | < 6 h (periodic backup) | < 30 min (failover or restore) | Full service unavailability |
| Database corruption / data loss | < 6 h (last full dump) | < 2 h (PiTR or dump restore) | Partial data loss |
| Object storage failure | 0 (uploads blocked) | < 1 h (failover or degrade) | Uploads unavailable; existing data safe |
| Redis failure | 0 (ephemeral) | < 5 min (restart) | Throttle reset; users re-auth |

---

## Related runbooks

- [restore-database.md](../runbooks/restore-database.md) — step-by-step restore procedure
- [db-unavailable.md](../runbooks/db-unavailable.md) — database connection failure
- [overview.md](../runbooks/overview.md) — full runbook index with escalation contacts
