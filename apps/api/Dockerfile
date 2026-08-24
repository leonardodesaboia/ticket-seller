# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# Copy workspace manifest + lockfile first (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml pnpm.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY apps/api/ apps/api/

# Compile TypeScript
RUN pnpm --filter @ticket-seller/api build

# Generate Prisma Client in the dist layer
RUN pnpm --filter @ticket-seller/api db:generate

# ──────────────────────────────────────────────
# Stage 2: Runner
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./dist

# Copy API node_modules (includes Prisma binaries)
COPY --from=builder /app/apps/api/node_modules ./node_modules

# Copy Prisma schema + migrations (needed for prisma migrate deploy in init container)
COPY --from=builder /app/apps/api/prisma ./prisma

# Copy generated Prisma engine from the root .prisma store
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1

CMD ["node", "dist/src/main.js"]
