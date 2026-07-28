Estado atual

Última atualização: 2026-07-28

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
TASK-007 — Banco e migrations.
TASK-008 — Organizações e multi-tenancy.
TASK-009 — Eventos.
TASK-010 — Inventário e reservas.
TASK-011 — Pedidos.
TASK-012 — Pagamento simulado.
TASK-013 — Emissão de ingressos.
TASK-014 — Check-in online.
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
- ferramentas padronizadas: TypeScript 5.9.3 (strict), ESLint 10 (flat config), Prettier 3.9.6, packages/tsconfig/ compartilhado;
- API backend: NestJS 10 + Fastify em apps/api/ com GET /api/v1/health/live e /ready, RFC 9457 errors, Pino logging, Swagger;
- infraestrutura local: Docker Compose com PostgreSQL 17, Redis 7, MinIO e Mailpit;
- web pública: Next.js 15 + App Router + Tailwind CSS 4 + shadcn/ui em apps/marketplace-web/.