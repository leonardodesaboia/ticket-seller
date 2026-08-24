# Runbook: Database Unavailable

**Severity:** P1 — Full service outage  
**RTO target:** < 30 minutes

---

## Symptoms

- API returning `503 Service Unavailable` on `GET /api/v1/health/ready`
- Logs contain: `P1001 Can't reach database server at ...` (Prisma error code)
- All write operations fail; read operations may partially succeed if cached

---

## Diagnosis

### Step 1 — Check API logs

```bash
docker logs api --tail=100 | grep -iE "prisma|database|P1001|connection"
```

Look for: `P1001` (can't reach DB), `P1002` (timeout), `P1008` (operations timeout).

### Step 2 — Verify PostgreSQL is running

Self-hosted:
```bash
docker ps | grep postgres
# or
systemctl status postgresql
```

Managed (AWS RDS, Supabase, Neon, etc.): check the provider console for instance status.

### Step 3 — Test direct connectivity

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

If this fails but PostgreSQL is running, the issue is networking (firewall, VPC, port).

### Step 4 — Check disk space

Full disk causes PostgreSQL to stop accepting writes and eventually crash:

```bash
df -h /var/lib/postgresql  # self-hosted
# managed: check storage metrics in provider console
```

### Step 5 — Check connection pool exhaustion

If Prisma is refusing new connections while the DB is technically running:

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
SELECT max_conn, used, res_for_super FROM
  (SELECT count(*) used FROM pg_stat_activity) q1,
  (SELECT setting::int max_conn FROM pg_settings WHERE name='max_connections') q2,
  (SELECT setting::int res_for_super FROM pg_settings WHERE name='superuser_reserved_connections') q3;
```

---

## Resolution

### Case A — PostgreSQL container stopped

```bash
docker start postgres
# or restart the service
docker restart postgres
```

Wait for health check to pass, then restart the API:
```bash
docker restart api
```

### Case B — Managed instance stopped

Start the instance from the provider console. Wait for it to reach "Available" status, then:
```bash
docker restart api
```

### Case C — Disk full

1. Identify large consumers:
   ```bash
   du -sh /var/lib/postgresql/data/* | sort -rh | head -20
   ```
2. Archive or delete old logs:
   ```bash
   find /var/lib/postgresql/data/log -name "*.log" -mtime +7 -delete
   ```
3. If WAL is accumulating: check that `archive_cleanup_command` or `pg_basebackup` is completing.
4. Increase disk volume if needed (provider console → resize volume).

### Case D — Connection pool exhausted

1. Kill idle connections older than 10 minutes:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < now() - interval '10 minutes';
   ```
2. Restart the API to reset the Prisma connection pool.

---

## Escalation

If not resolved within 30 minutes:
- Declare P0 and begin [restore-database.md](restore-database.md) procedure.
- Notify stakeholders of extended outage.

---

## Post-incident

1. Document root cause, timeline, and resolution in the incident log.
2. If disk was full: add disk usage alerts at 80% and 90% thresholds.
3. If connection pool exhausted: review Prisma pool configuration (`connection_limit` in DATABASE_URL).
