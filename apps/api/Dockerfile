# syntax=docker/dockerfile:1

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22.18.0-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# Workspace manifests first — maximises cache hits when only source changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml pnpm.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY apps/api/ apps/api/

# Generate Prisma client before compiling TypeScript so the generated
# types are available to tsc.
RUN pnpm --filter @ticket-seller/api db:generate

# Compile TypeScript
RUN pnpm --filter @ticket-seller/api build

# Create a self-contained production directory.
# pnpm deploy resolves all pnpm symlinks to real files and strips devDependencies.
# prisma CLI is included because it was moved to dependencies (needed for api-migrate).
RUN pnpm --filter @ticket-seller/api deploy --prod --legacy /prod/api

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22.18.0-alpine AS runner

# openssl is required for Prisma to detect the OpenSSL version on Alpine (musl)
# and select the correct pre-built engine binary without attempting a download.
RUN apk add --no-cache openssl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Real node_modules from pnpm deploy (no symlinks, production deps only).
# --chown ensures appuser can write to node_modules/.pnpm for Prisma engine setup.
COPY --chown=appuser:appgroup --from=builder /prod/api/node_modules ./node_modules

# Compiled application (TypeScript output; dist/ is not in pnpm deploy because
# the package has no "files" field, so copy from the original build path)
COPY --chown=appuser:appgroup --from=builder /app/apps/api/dist ./dist

# Prisma schema + migrations (needed for prisma migrate deploy in api-migrate)
COPY --chown=appuser:appgroup --from=builder /app/apps/api/prisma ./prisma

USER appuser

# Increase libuv thread pool so argon2 hashing does not starve DNS and fs
# operations. Default is 4; 16 supports up to 16 concurrent bcrypt/argon2 calls.
ENV UV_THREADPOOL_SIZE=16

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1

CMD ["node", "dist/src/main.js"]
