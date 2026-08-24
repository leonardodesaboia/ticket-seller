# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml pnpm.json ./
COPY apps/marketplace-web/package.json apps/marketplace-web/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY apps/marketplace-web/ apps/marketplace-web/

ENV NEXT_TELEMETRY_DISABLED=1

# Ensure public dir exists so COPY in runner stage doesn't fail
RUN mkdir -p apps/marketplace-web/public

RUN pnpm --filter @ticket-seller/marketplace-web build

# ──────────────────────────────────────────────
# Stage 2: Runner
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/marketplace-web/.next/standalone ./
COPY --from=builder /app/apps/marketplace-web/.next/static ./.next/static
COPY --from=builder /app/apps/marketplace-web/public ./public

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["node", "apps/marketplace-web/server.js"]
