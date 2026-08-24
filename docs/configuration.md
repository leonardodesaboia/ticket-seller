# Configuration Reference

All environment variables across the monorepo, with defaults and production requirements.

---

## API (`apps/api`)

### Core

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `NODE_ENV` | Yes | `development` | Runtime environment | `production` |
| `PORT` | No | `3000` | HTTP listen port | `3000` |
| `LOG_LEVEL` | No | `info` | Pino log level | `info` |
| `CORS_ORIGINS` | Yes | `*` | Comma-separated allowed origins. Wildcard forbidden in production. | `https://app.example.com,https://admin.example.com` |

### Database

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |

### Authentication

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `JWT_SECRET` | Yes | — | HMAC secret for JWT signing. Minimum 32 characters. | `your-secret-minimum-32-chars-long` |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRY` | No | `30d` | Refresh token lifetime | `30d` |

### Rate Limiting (Redis)

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `REDIS_URL` | No | — | Redis connection string. Without this, in-memory throttling is used (not suitable for multi-instance). | `redis://:password@redis:6379/0` |

### Object Storage

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `OBJECT_STORAGE_PROVIDER` | No | `minio` | Storage backend: `minio` or `s3` | `s3` |
| `MINIO_ENDPOINT` | No | `http://localhost:9000` | MinIO endpoint URL | `http://minio:9000` |
| `MINIO_ACCESS_KEY` | No | `minioadmin` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | No | `minioadmin` | MinIO secret key | `supersecret` |
| `MINIO_BUCKET` | No | `ticket-seller` | MinIO bucket name | `ticket-seller` |
| `AWS_S3_BUCKET` | If `OBJECT_STORAGE_PROVIDER=s3` | — | S3 bucket name | `my-bucket` |
| `AWS_S3_REGION` | No | `us-east-1` | S3 region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | If `OBJECT_STORAGE_PROVIDER=s3` | — | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | If `OBJECT_STORAGE_PROVIDER=s3` | — | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

### Email

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `RESEND_API_KEY` | If using Resend | — | Resend API key for transactional email | `re_xxxxxxxxxxxx` |
| `SMTP_HOST` | No | `localhost` | SMTP host (used when `RESEND_API_KEY` absent) | `smtp.example.com` |
| `SMTP_PORT` | No | `1025` | SMTP port | `587` |
| `SMTP_FROM` | No | `noreply@ticket-seller.local` | Sender address | `noreply@example.com` |
| `FRONTEND_URL` | No | `http://localhost:3001` | Base URL for email links | `https://app.example.com` |

### Payout Gateway

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `FAKE_PAYOUT_SECRET` | No | — | HMAC secret for the fake payout webhook. Required if using the fake payout adapter. | `payout-webhook-secret-32-chars` |

### Observability (OpenTelemetry)

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `OTEL_ENABLED` | No | `false` | Enable OpenTelemetry tracing | `true` |
| `OTEL_SERVICE_NAME` | No | `ticket-seller-api` | Service name in traces | `ticket-seller-api` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318` | OTLP HTTP exporter endpoint | `http://jaeger:4318` |

---

## Marketplace Web (`apps/marketplace-web`)

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | — | Public URL of the API, accessible from the browser | `https://api.example.com` |
| `NEXT_TELEMETRY_DISABLED` | No | — | Set to `1` to disable Next.js telemetry | `1` |

---

## Backoffice Web (`apps/backoffice-web`)

| Variable | Required in Prod | Default | Description | Example |
|----------|-----------------|---------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | — | Public URL of the API, accessible from the browser | `https://api.example.com` |
| `NEXT_TELEMETRY_DISABLED` | No | — | Set to `1` to disable Next.js telemetry | `1` |

---

## Production Checklist

Before going live, verify:

- [ ] `JWT_SECRET` is at least 32 characters and stored in a secret manager
- [ ] `CORS_ORIGINS` does not contain `*`
- [ ] `DATABASE_URL` points to a production database with SSL
- [ ] `REDIS_URL` is set for multi-instance rate limiting
- [ ] `OBJECT_STORAGE_PROVIDER` is `s3` with proper credentials, or MinIO in production mode
- [ ] `RESEND_API_KEY` is set for transactional emails
- [ ] `FRONTEND_URL` matches the actual frontend domain for email links
- [ ] `LOG_LEVEL` is `info` or `warn` (not `debug` or `trace`)
- [ ] `NODE_ENV` is `production`

---

## docker-compose.prod.yml additional variables

These variables are used in `docker-compose.prod.yml` and are not read by application code:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL superuser name | `ticket_seller` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `supersecretpassword` |
| `REDIS_PASSWORD` | Redis authentication password | `redispassword` |
| `IMAGE_TAG` | Docker image tag for all services | `v1.0.0` |
| `API_URL` | API URL passed to frontends as `NEXT_PUBLIC_API_URL` | `https://api.example.com` |
| `API_PORT` | Host port mapping for the API (default `3000`) | `3000` |
| `MARKETPLACE_PORT` | Host port mapping for marketplace (default `3001`) | `3001` |
| `BACKOFFICE_PORT` | Host port mapping for backoffice (default `3002`) | `3002` |
