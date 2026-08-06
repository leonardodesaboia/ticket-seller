Estado atual

Última atualização: 2026-07-29 (TASK-020)

Fase

Fundação e padronização do desenvolvimento assistido por IA.

Objetivo da fase

Criar um repositório em que agentes consigam trabalhar com:

contexto limitado;
tarefas pequenas;
regras explícitas;
validações automáticas;
documentação oficial;
histórico de decisões.
Implementado
diretórios iniciais;
documentação básica;
regras globais para agentes;
estrutura de tarefas;
definição inicial do produto;
definição arquitetural inicial;
monorepo inicializado com pnpm 11.17.0, Turborepo 2.10.7 e Node.js 22.18.0;
TypeScript 5.9.3, ESLint 10.8.0 e Prettier 3.9.6 configurados no workspace.
Em andamento

Nenhuma tarefa em andamento.

Próxima fase

Banco de dados, migrations e módulos de domínio.

Próximas tarefas
TASK-001 — Fundação do repositório. (CONCLUÍDA)
TASK-002 — Bootstrap do monorepo. (CONCLUÍDA)
TASK-003 — Padronização de ferramentas. (CONCLUÍDA)
TASK-004 — API Bootstrap. (CONCLUÍDA)
TASK-005 — Infraestrutura local. (CONCLUÍDA)
TASK-006 — Marketplace Web Bootstrap. (CONCLUÍDA)
TASK-007 — Application Structure Standards. (CONCLUÍDA)
TASK-008 — Database Foundation. (CONCLUÍDA)
TASK-009 — Backoffice Web Bootstrap. (CONCLUÍDA)
TASK-010 — Continuous Integration. (CONCLUÍDA)
TASK-011 — Actor Foundation. (CONCLUÍDA)
TASK-012 — CreateOrganization. (CONCLUÍDA)
TASK-013 — CreateEvent + GetEvent. (CONCLUÍDA)
TASK-014 — Backoffice UI. (CONCLUÍDA)
TASK-015 — ListOrganizationEvents + ParseUUIDPipe. (CONCLUÍDA)
TASK-016 — UpdateEvent com controle de concorrência. (CONCLUÍDA)
TASK-017 — Event Management Backoffice. (CONCLUÍDA)
TASK-018 — Event Schedule, Venue e Currency Foundation. (CONCLUÍDA)
TASK-019 — Ticket Types Foundation. (CONCLUÍDA)
TASK-020 — Event Configuration Backoffice. (CONCLUÍDA)
Decisões confirmadas
monólito modular;
arquitetura hexagonal;
TypeScript;
PostgreSQL;
Redis não será fonte oficial de estoque;
integrações externas por adapters;
pagamento agnóstico;
FakePaymentGateway antes do provider real;
MVP para até 100 usuários ativos simultaneamente;
evolução por escalabilidade horizontal;
microserviços não serão utilizados no MVP.
Decisões pendentes
nome comercial;
provedor real de pagamentos;
provedor de autenticação;
provedor de e-mail;
fila inicial;
nuvem inicial;
política de split;
prazo de repasse.
Problemas conhecidos

Nenhum problema técnico registrado.

Fora do escopo atual
implementação de domínio;
integração real com PSP;
aplicação nativa;
check-in offline;
Kubernetes;
microserviços;
multi-cloud ativa.

## Implementado

- fundação documental para desenvolvimento com IA;
- regras globais em AGENTS.md;
- workflows PLAN, IMPLEMENT, REVIEW e FIX;
- templates de tarefas, ADRs e relatórios;
- documentação inicial dos módulos do domínio;
- monorepo inicializado: package.json, pnpm-workspace.yaml, turbo.json, .npmrc, .node-version, .nvmrc, pnpm-lock.yaml;
- ferramentas padronizadas: TypeScript 5.9.3 (strict), ESLint 10.8.0 (flat config), Prettier 3.9.6, packages/tsconfig/ compartilhado, Turborepo 2.10.7;
- runtime: Node.js 22.18.0 LTS, pnpm 11.17.0;
- API backend: NestJS 10.4.22 + Fastify 4.29.1 em apps/api/ — GET /api/v1/health/live e /ready, RFC 9457 errors, Pino logging (nestjs-pino 3.5.0), Swagger (@nestjs/swagger 7.4.0);
- infraestrutura local: Docker Compose com PostgreSQL 17-alpine, Redis 7-alpine, MinIO latest, Mailpit latest;
- web pública: Next.js 15.5.22 + React 19.2.8 + App Router + Tailwind CSS 4 + shadcn/ui em apps/marketplace-web/;
- arquitetura de pastas: platform/ na API, feature-first + shared/ nos frontends, design tokens em packages/design-tokens/;
- design tokens: pacote @ticket-seller/design-tokens com tokens semânticos HSL + @theme inline no marketplace;
- banco de dados: Prisma 5.22.0 + PostgreSQL — PrismaService @Global, DatabaseModule, DATABASE_URL validado por Zod, 3 migrations (users, organizations, infrastructure), GET /ready verifica banco real, testes de integração com Testcontainers (5/5 passando);
- backoffice: Next.js 15 + App Router + Tailwind CSS 4 + design tokens em apps/backoffice-web/ (porta 3002), estrutura shared/ idêntica ao marketplace, Button primitivo com tokens semânticos, cliente de API centralizado;
- CI: GitHub Actions em .github/workflows/ci.yml — 4 jobs paralelos (quality, test, build, validate), Testcontainers para integração, concorrência com cancel-in-progress, permissões mínimas;
- actor foundation: IActorAdapter port, DevelopmentActorAdapter (lê X-Dev-User-Id, desabilitado em production), ActorGuard, CurrentActor decorator — TASK-011;
- CreateOrganization: POST /api/v1/organizations, módulo hexagonal completo (domain, application, infrastructure, presentation), criação atômica via $transaction (org + OWNER member + outbox event), 6 testes de integração — TASK-012;
- backoffice features: organizations/new, organizations/[id]/events/new, organizations/[id]/events/[id] com TanStack Query, React Hook Form + Zod — TASK-014;
- CreateEvent + GetEvent: POST e GET /api/v1/organizations/:organizationId/events/:eventId, módulo hexagonal completo com IOrganizationAccessPort port, role check (OWNER/ADMIN/EVENT_MANAGER para criar), evento nasce como DRAFT, outbox event.created.v1 atômico, 11 testes de integração — TASK-013;
- backoffice UI completa: organizations/new, events/new, events/[id] com TanStack Query, React Hook Form + Zod, design tokens — TASK-014;
- ListOrganizationEvents: GET /api/v1/organizations/:orgId/events com paginação keyset (createdAt DESC + id DESC), cursor base64url, ParseUUIDPipe em todos os parâmetros UUID, Fastify adapter corrigido nos testes de integração — TASK-015;
- UpdateEvent: PATCH /api/v1/organizations/:orgId/events/:eventId, coluna version INTEGER (migration 20260729000002_event_version), optimistic locking via updateMany WHERE version=N, 409 Conflict + 422 UnprocessableEntity + 403 Forbidden, outbox event.updated.v1 atômico com changedFields — TASK-016;
- backoffice event management: listagem paginada /organizations/[id]/events, formulário de edição /organizations/[id]/events/[id]/edit com detecção de conflito 409 — TASK-017;
- event schedule/venue/currency: migration events (format, startsAt, endsAt, timezone, onlineInfo, venueId, currency), módulo venues (POST/GET), PATCH /events/:id/configuration com optimistic lock, outbox, cross-module IVenueAccessPort — TASK-018;
- ticket types: migration ticket_types, domínio dentro de events/domain/ticket-types/, POST/GET/PATCH com idempotência scoped (orgId:eventId:key), deactivation via status=INACTIVE, currency lock (422 quando há ingressos ativos) — TASK-019;
- backoffice configuração: VenueSelect com criação inline, TicketTypeList com deactivation + version conflict, EventConfigurationForm com campos condicionais por formato, página /configuration integrada, utilitário money.ts (toMinorUnits/toDisplayValue) — TASK-020.
- publication readiness: PublicationReadinessPolicy pura (20 códigos estáveis), GET /events/:id/publication-readiness administrativo, snapshot com onlineConfigured (nunca onlineInfo) — TASK-021.
- event publication: POST /events/:id/publish, transição atômica e idempotente DRAFT → PUBLISHED com readiness recalculada sob lock, slug global imutável + publishedAt, outbox event.published.v1, auditoria event.published (primeiro uso de audit_entries), campos Event.slug/publishedAt aditivos, migration 005 com constraint events_published_fields_check e índice parcial de eventos publicados — TASK-022 (integrada em develop, commit 26a0a72).
- catálogo público: GET /api/v1/public/events (listagem keyset startsAt ASC, id ASC, cursor opaco, PUBLISHED em andamento/futuros) e GET /api/v1/public/events/:slug (detalhe PUBLISHED, acessível após término), sem autenticação, DTOs públicos independentes (evento/venue público/ticket types ativos por preço), onlineInfo/endereço/IDs/capacidade nunca expostos, 404 indistinguível, Cache-Control public max-age=60 swr=300 — TASK-023 (integrada em develop, commit c87914d).
