Marketplace de Ingressos

Marketplace multi-tenant para criação, venda, gestão e validação de ingressos.

Estado atual

O projeto está na fase de fundação e padronização do desenvolvimento assistido por IA.

Ainda não existem aplicações, dependências ou funcionalidades de negócio implementadas.

Objetivo do MVP

O primeiro MVP deverá permitir:

criação de uma organização;
criação e publicação de um evento;
criação de lote e estoque;
reserva temporária;
criação de pedido;
pagamento simulado;
emissão de ingresso;
geração de QR Code;
check-in online;
bloqueio de segunda utilização.
Capacidade inicial

Meta inicial:

até 100 usuários ativos simultaneamente;
até 50 checkouts simultâneos;
até 10 reservas por segundo nos testes;
até 20 check-ins por segundo nos testes.

Esses números são metas técnicas de validação, não garantias comerciais.

Arquitetura

O projeto utiliza:

monólito modular;
arquitetura hexagonal;
ports and adapters;
DDD pragmático;
PostgreSQL como fonte transacional;
Redis para cache e dados temporários;
processamento assíncrono;
transactional outbox;
consumidores idempotentes;
containers stateless.

Leia antes de trabalhar:

AGENTS.md
docs/INDEX.md
docs/CURRENT_STATE.md
Estrutura
.
├── AGENTS.md
├── README.md
├── apps/
├── packages/
├── infra/
├── tests/
├── docs/
└── .ai/
Documentação
Produto: docs/PROJECT.md
Domínio: docs/DOMAIN.md
Arquitetura: docs/ARCHITECTURE.md
Mapa: docs/REPOSITORY_MAP.md
Estado atual: docs/CURRENT_STATE.md
Decisões: docs/decisions/
Módulos: docs/modules/
Pesquisa: docs/research/
Desenvolvimento com IA

Toda tarefa deve possuir um arquivo em:

.ai/tasks/

Fluxo oficial:

Especificar
→ PLAN
→ Aprovar
→ IMPLEMENT
→ Testar
→ REVIEW
→ FIX
→ Commit
→ Atualizar documentação

Os agentes não devem explorar o repositório inteiro sem necessidade.

Convenção de commits
feat(scope): descrição
fix(scope): descrição
test(scope): descrição
docs(scope): descrição
refactor(scope): descrição
chore(scope): descrição

Exemplos:

chore: establish AI development foundation
feat(inventory): implement atomic reservation
fix(payments): prevent duplicate webhook processing
test(checkin): add concurrent validation scenario
Branches
feature/TASK-000-description
fix/BUG-000-description
docs/ADR-000-description
Segurança

Nunca versionar:

.env;
credenciais;
tokens;
chaves privadas;
dados pessoais reais;
certificados privados;
dumps de produção;
payloads reais de cartões;
backups não sanitizados.