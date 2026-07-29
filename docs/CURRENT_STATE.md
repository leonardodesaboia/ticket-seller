Estado atual

Última atualização: 2026-07-29

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
TASK-010 — Continuous Integration.
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
- backoffice: Next.js 15 + App Router + Tailwind CSS 4 + design tokens em apps/backoffice-web/ (porta 3002), estrutura shared/ idêntica ao marketplace, Button primitivo com tokens semânticos, cliente de API centralizado.
