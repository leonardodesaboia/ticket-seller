# TASK-009 — Backoffice Web Bootstrap: Completion Report

**Status:** COMPLETED  
**Branch:** `feature/TASK-009-backoffice-web-bootstrap`  
**Worktree:** `../ticket-seller-task-009`  
**Date:** 2026-07-29

---

## Scope

Bootstrap the backoffice Next.js 15 application following the architecture defined in TASK-007: feature-first folder structure, design token integration, centralized API client, and no premature business logic.

---

## What Was Implemented

### 1. Application (`apps/backoffice-web/`)

Port 3002. `@ticket-seller/backoffice-web` in pnpm workspace.

### 2. Source Structure

```text
src/
├── app/
│   ├── layout.tsx        — root layout, lang="pt-BR", metadata
│   ├── page.tsx          — placeholder home (no business data)
│   ├── loading.tsx       — spinner using border-primary token
│   ├── error.tsx         — error boundary with reset (client component)
│   ├── not-found.tsx     — 404 with Link back home
│   ├── globals.css       — Tailwind + design-tokens import
│   └── page.test.tsx     — 3 tests for home page
└── shared/
    ├── api/
    │   └── api-client.ts — fetch stub with NEXT_PUBLIC_API_URL
    ├── lib/
    │   └── utils.ts      — cn() via clsx + tailwind-merge
    └── ui/
        └── primitives/
            └── button.tsx — Button with CVA variants using semantic tokens
```

### 3. Design Tokens Integration

`globals.css` imports `@ticket-seller/design-tokens/tokens.css` and maps all semantic HSL variables to Tailwind v4 `@theme inline`. No duplicate color palette defined. Components use semantic class names (`bg-primary`, `text-muted-foreground`, `border-destructive`).

### 4. Configuration Files

- `package.json` — identical dependency set to marketplace-web, port 3002
- `tsconfig.json` — extends `@ticket-seller/tsconfig/nextjs.json`, `@/*` alias
- `next.config.ts` — `reactStrictMode: true`
- `jest.config.ts` — nextJest + jsdom + jest-dom setup
- `components.json` — shadcn aliases pointing to `shared/ui/*`
- `.env.example` — `NEXT_PUBLIC_API_URL=http://localhost:3000`

---

## What Was NOT Implemented (Intentional)

- Authentication or authorization
- Organization management
- Event management
- Real dashboard data
- Finance or payout flows
- Permissions or roles
- Fake/mock business data

---

## Validation Results

```
✓ pnpm typecheck     — TypeScript clean
✓ pnpm lint          — No ESLint errors (deprecation warnings only, non-blocking)
✓ pnpm test          — 3/3 tests pass
✓ pnpm build         — Optimized production build successful
```

---

## Files Created

| Path | Action |
|---|---|
| `apps/backoffice-web/package.json` | Created |
| `apps/backoffice-web/tsconfig.json` | Created |
| `apps/backoffice-web/next.config.ts` | Created |
| `apps/backoffice-web/next-env.d.ts` | Created |
| `apps/backoffice-web/jest.config.ts` | Created |
| `apps/backoffice-web/jest.setup.ts` | Created |
| `apps/backoffice-web/components.json` | Created |
| `apps/backoffice-web/.env.example` | Created |
| `apps/backoffice-web/src/app/layout.tsx` | Created |
| `apps/backoffice-web/src/app/page.tsx` | Created |
| `apps/backoffice-web/src/app/loading.tsx` | Created |
| `apps/backoffice-web/src/app/error.tsx` | Created |
| `apps/backoffice-web/src/app/not-found.tsx` | Created |
| `apps/backoffice-web/src/app/globals.css` | Created |
| `apps/backoffice-web/src/app/page.test.tsx` | Created |
| `apps/backoffice-web/src/shared/api/api-client.ts` | Created |
| `apps/backoffice-web/src/shared/lib/utils.ts` | Created |
| `apps/backoffice-web/src/shared/ui/primitives/button.tsx` | Created |
| `pnpm-lock.yaml` | Updated (backoffice-web entry added) |
