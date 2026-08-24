# Runbook: Payout Stuck in PROCESSING

**Severity:** P2 — Degraded functionality (financial)  
**RTO target:** < 1 hour

---

## Background

Payouts transition from `REQUESTED` → `PROCESSING` when sent to the provider, then to `SUCCEEDED`
or `FAILED` when the provider webhook arrives. The `ReconciliationWorker` periodically queries
the provider for status and emits `finance.reconciliation-mismatch.v1` when discrepancies are found.

A payout stuck in `PROCESSING` means either:
- The provider webhook was never delivered, or
- The reconciliation worker has not yet polled the provider.

---

## Symptoms

- Payout row with `status = 'PROCESSING'` for more than 1 hour
- Log entry: `reconciliation mismatch detected` from `ReconciliationWorker`
- Merchant reports pending payout not arriving

---

## Diagnosis

### Step 1 — Identify stuck payouts

```sql
SELECT
  id,
  external_payout_id,
  status,
  amount_minor,
  currency,
  requested_at,
  now() - requested_at AS age
FROM payouts
WHERE status = 'PROCESSING'
  AND requested_at < now() - interval '1 hour'
ORDER BY requested_at ASC;
```

### Step 2 — Check ReconciliationWorker logs

```bash
docker logs api --tail=500 | grep -iE "reconciliation|payout|mismatch"
```

### Step 3 — Query provider directly

For the FakePayoutGateway: check if the fake webhook was delivered by looking at `payout_webhook_events`:

```sql
SELECT *
FROM payout_webhook_events
WHERE external_payout_id = '<id from step 1>'
ORDER BY received_at DESC;
```

For a real provider: open the provider dashboard and look up the `external_payout_id`.

### Step 4 — Check for outbox events related to this payout

```sql
SELECT id, event_type, processed_at, failed_at, created_at
FROM outbox_events
WHERE payload->>'payoutId' = '<payout-uuid>'
ORDER BY created_at DESC;
```

---

## Resolution

### Case A — Provider confirms SUCCEEDED but webhook never arrived

The `payout_webhook_events` table has no row for this payout. Simulate the webhook delivery:

For the FakePayoutGateway: re-trigger the callback endpoint manually (check the fake gateway
adapter for the endpoint path).

For a real provider: use the provider dashboard to re-send the webhook, or use their API to
trigger webhook replay.

### Case B — ReconciliationWorker is stopped

The worker is not polling for status updates. See [worker-stopped.md](worker-stopped.md).
After restarting, the worker will re-check the provider status on the next poll cycle.

### Case C — Provider confirms FAILED

Handle the same as Case A, but trigger the failure webhook. The payout status will transition
to `FAILED`, and the held balance will be released back to `available`.

### Case D — Amount discrepancy detected by reconciliation

**Never adjust `ledger_entries` directly.**

1. Escalate to the finance team.
2. Document the discrepancy: payout ID, expected amount, provider-reported amount, timestamp.
3. Create a manual audit entry recording the discrepancy and the decision made.
4. A `FinancialAdjustment` feature (post-MVP) will handle these cases programmatically.

---

## Post-incident

1. If the webhook was lost: investigate webhook delivery reliability at the provider (retry policy, endpoint reachability).
2. Ensure `ReconciliationWorker` poll interval is appropriate (currently every scheduled interval).
3. Consider adding an alert: any payout in `PROCESSING` for > 2 hours triggers a notification.
