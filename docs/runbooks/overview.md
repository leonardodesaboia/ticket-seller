# Runbooks Overview

Operational runbooks for the ticket-seller platform. Each runbook covers symptoms, diagnosis,
resolution steps, and escalation criteria.

---

## RPO / RTO by Scenario

| Scenario | RPO | RTO | Severity | Runbook |
|----------|-----|-----|----------|---------|
| API process failure | 0 | < 5 min | P2 | Restart the container |
| Worker failure (email, settlements) | 0 | < 5 min | P2 | [worker-stopped.md](worker-stopped.md) |
| Outbox event backlog | 0 | < 30 min | P2 | [outbox-backlog.md](outbox-backlog.md) |
| Database unavailable | < 6 h | < 30 min | P1 | [db-unavailable.md](db-unavailable.md) |
| Database restore (corruption) | < 6 h | < 2 h | P0 | [restore-database.md](restore-database.md) |
| Payout stuck in PROCESSING | 0 | < 1 h | P2 | [payout-stuck.md](payout-stuck.md) |
| Payment webhook delayed | 0 | < 1 h | P2 | [payment-webhook-delayed.md](payment-webhook-delayed.md) |

**Severity:**
- P0 — Data loss or financial discrepancy. Page on-call immediately.
- P1 — Full service outage. Fix within 30 minutes.
- P2 — Degraded functionality. Fix within 2 hours during business hours.

---

## Runbook Index

| File | When to use |
|------|-------------|
| [db-unavailable.md](db-unavailable.md) | PostgreSQL unreachable; API returning 503 on /health/ready |
| [worker-stopped.md](worker-stopped.md) | Emails not sent, settlements delayed, reconciliation not running |
| [outbox-backlog.md](outbox-backlog.md) | `outbox_events` accumulating unprocessed rows |
| [payout-stuck.md](payout-stuck.md) | Payout in PROCESSING state for > 1 hour |
| [payment-webhook-delayed.md](payment-webhook-delayed.md) | Order stuck in PROCESSING after PSP approval |
| [restore-database.md](restore-database.md) | Data loss or corruption requiring a full backup restore |

---

## General Principles

1. **Check `docker logs api` first.** Most root causes are visible in structured JSON logs.
2. **Never update `ledger_entries` directly.** Financial data is append-only. Escalate discrepancies.
3. **Outbox is the source of truth for async events.** If an email or notification wasn't sent,
   the outbox row is the evidence and the retry mechanism.
4. **`prisma migrate deploy` is idempotent.** Safe to re-run if migrations are suspected to be incomplete.
5. **Document every incident.** After resolution, record: timeline, root cause, resolution, and follow-up items.

---

## Related Documents

- [backup-strategy.md](../operations/backup-strategy.md) — backup frequency, retention, and restore testing
- [configuration.md](../configuration.md) — all environment variables
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system overview and module map
