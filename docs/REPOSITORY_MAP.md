Mapa do repositório

Raiz

AGENTS.md — Regras globais para agentes e pessoas.

Aplicações

apps/ — Aplicações executáveis.

```text
apps/
├── api/                   — API NestJS + Fastify (ATIVA)
│   ├── prisma/            — schema.prisma, migrations (5 aplicadas)
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── platform/
│   │   │   ├── config/   — env.ts (Zod, DATABASE_URL)
│   │   │   ├── database/ — prisma.service.ts, prisma.module.ts (@Global)
│   │   │   ├── health/   — health.controller.ts, health.module.ts
│   │   │   └── http/
│   │   │       ├── filters/  — http-exception.filter.ts (RFC 9457)
│   │   │       ├── guards/   — actor.guard.ts
│   │   │       ├── adapters/ — development-actor.adapter.ts
│   │   │       └── actor-adapter.port.ts
│   │   ├── shared/kernel/ — actor.types.ts, current-actor.decorator.ts
│   │   └── modules/
│   │       ├── organizations/ — POST /api/v1/organizations (hexagonal completo)
│   │       └── events/        — POST/GET/PATCH /api/v1/organizations/:id/events (hexagonal completo)
│   │                            ParseUUIDPipe em todos os params UUID; version (optimistic locking)
│   └── test/
│       ├── e2e/          — health.e2e-spec.ts
│       └── integration/  — database, organizations, events (Testcontainers, FastifyAdapter)
├── marketplace-web/       — Next.js 15 + App Router (ATIVA)
│   └── src/
│       ├── app/          — layout, page, loading, error, not-found, globals.css
│       └── shared/
│           ├── api/      — api-client.ts
│           ├── lib/      — utils.ts (cn)
│           └── ui/
│               └── primitives/ — button.tsx
├── backoffice-web/        — Next.js 15 + App Router (ATIVA)
│   └── src/
│       ├── app/
│       │   ├── layout, page, providers.tsx
│       │   └── organizations/[organizationId]/
│       │       ├── events/           — listagem paginada (EventList + load-more)
│       │       ├── events/new/       — criação de evento
│       │       ├── events/[eventId]/ — detalhe do evento
│       │       └── events/[eventId]/edit/ — formulário de edição (apenas DRAFT, 409 detection)
│       ├── features/
│       │   ├── organizations/ — types, schemas, api, hooks, CreateOrganizationForm
│       │   └── events/        — types, schemas, api, hooks, CreateEventForm, EventDetail,
│       │                         EventList, EditEventForm, useListEvents, useUpdateEvent
│       └── shared/
│           ├── api/      — api-client.ts
│           ├── lib/      — utils.ts (cn)
│           └── ui/
│               └── primitives/ — button.tsx
├── worker/                — PREVISTO
├── scheduler/             — PREVISTO
└── checkin-pwa/           — PREVISTO
```

Pacotes

packages/ — Código compartilhado entre aplicações.

```text
packages/
├── design-tokens/         — tokens.css (tokens semânticos, ATIVO)
├── tsconfig/              — configurações TypeScript compartilhadas (ATIVO)
├── api-client/            — PREVISTO (gerado do OpenAPI)
├── contracts/             — PREVISTO
├── observability/         — PREVISTO
├── ui/                    — PREVISTO (promovido de apps quando necessário)
└── testing/               — PREVISTO
```

Entidades do domínio do backend não devem ser compartilhadas com o frontend.

Documentação

docs/ — Fonte oficial de conhecimento.

```text
docs/
├── INDEX.md
├── PROJECT.md
├── ARCHITECTURE.md
├── DOMAIN.md
├── CURRENT_STATE.md
├── REPOSITORY_MAP.md
├── decisions/
│   ├── ADR-001-modular-monolith.md
│   ├── ADR-002-postgresql.md
│   ├── ADR-003-payment-gateway-port.md
│   └── ADR-004-application-folder-architecture.md
└── modules/
    └── [módulos de domínio]
```

CI/CD

```text
.github/
└── workflows/
    └── ci.yml     — GitHub Actions: quality, test, build, validate (4 jobs paralelos)
```

IA

.ai/ — Suporte ao desenvolvimento assistido por IA.

```text
.ai/
├── tasks/         — especificações de tarefas
├── reports/       — relatórios de conclusão
├── workflows/     — PLAN, IMPLEMENT, REVIEW, FIX
├── skills/        — skills especializadas
├── scripts/       — validate-architecture.sh, validate-migrations.sh, scan-secrets.sh...
├── templates/     — templates de tarefas, ADRs, relatórios
└── coordination/  — ACTIVE_TASKS.md, OWNERSHIP.md, DEPENDENCIES.md, INTEGRATION_QUEUE.md
```

Infraestrutura

```text
compose.yaml        — Docker Compose: PostgreSQL 17, Redis 7, MinIO, Mailpit
infra/
├── docker/
├── terraform/
└── environments/
```

Testes globais

```text
tests/              — testes que cruzam múltiplas aplicações (quando necessário)
├── integration/
├── concurrency/
├── contract/
├── e2e/
└── load/
```

Testes específicos de módulo ficam dentro do app ou pacote correspondente.
