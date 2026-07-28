# Local Infrastructure

Docker Compose setup for local development. Provides PostgreSQL, Redis, MinIO and Mailpit.

## Prerequisites

- Docker Engine 24+
- Docker Compose v2

## Quick start

```bash
# Copy the example env file (only needed once)
cp .env.example .env

# Start all services in the background
docker compose up -d

# Check health status
docker compose ps

# Stop all services (data is preserved in volumes)
docker compose down

# Stop and delete all data volumes
docker compose down -v
```

## Services

| Service    | Port(s)          | Default credentials                  |
|------------|------------------|--------------------------------------|
| PostgreSQL | 5432             | user: postgres / password: postgres  |
| Redis      | 6379             | no authentication                    |
| MinIO API  | 9000             | user: minioadmin / pass: minioadmin  |
| MinIO UI   | 9001             | user: minioadmin / pass: minioadmin  |
| Mailpit    | 1025 (SMTP)      | no authentication                    |
| Mailpit UI | 8025 (HTTP)      | open: http://localhost:8025          |

## Port conflicts

If a port is already in use on your machine, override it in your `.env` file:

```dotenv
PORT_POSTGRES=5433
PORT_REDIS=6380
```

## Volumes

Persistent volumes are named `ticket-seller_postgres_data`, `ticket-seller_redis_data` and `ticket-seller_minio_data`. They survive `docker compose down` but are removed with `docker compose down -v`.

## Network

All services share the `ticket-seller-network` bridge network. Within that network, service names resolve as hostnames (e.g. `postgres`, `redis`, `minio`, `mailpit`).
