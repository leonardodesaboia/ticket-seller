Arquitetura
Objetivo

Começar com baixa complexidade operacional sem criar uma base descartável.

Estratégia

Utilizar um monólito modular containerizado, com processos stateless e dependências externas acessadas por ports.

Visão inicial
Clientes
   │
CDN / WAF
   │
Load Balancer
   │
API stateless
   │
Monólito modular
   ├── PostgreSQL
   ├── Redis
   ├── Fila
   ├── Object Storage
   └── Provedor de pagamento
Aplicações previstas
apps/
├── marketplace-web/
├── backoffice-web/
├── checkin-pwa/
├── api/
├── worker/
└── scheduler/

A PWA de check-in e os processos especializados podem ser criados apenas quando necessários.

Processos iniciais
API

Responsável por:

endpoints REST;
autenticação;
autorização;
validação;
comandos rápidos;
consultas;
publicação de eventos via outbox.
Worker

Responsável por:

emissão de ingressos;
notificações;
processamento de eventos;
tarefas assíncronas.
Scheduler

Responsável por:

liberação de reservas expiradas;
conciliações;
tarefas periódicas.

O scheduler não deve ser executado em todas as instâncias da API.

Persistência

PostgreSQL é o banco transacional oficial.

Utilizar Prisma para operações convencionais.

Utilizar SQL nativo para:

estoque;
concorrência;
check-in;
ledger;
outbox;
locks;
consultas financeiras críticas.
Cache

Utilizar Redis com cache-aside.

Pode armazenar:

eventos públicos;
categorias;
sessões;
permissões pouco voláteis;
tokens temporários;
rate limiting.

Não pode ser fonte oficial de:

estoque;
pagamento;
ingresso;
saldo;
repasse;
check-in.
Mensageria

O domínio utilizará uma porta MessageBus.

Primeira implementação pode utilizar:

SQS;
RabbitMQ;
BullMQ.

A escolha não deve contaminar o domínio.

Mensagens devem ser versionadas.

Object storage

Arquivos devem ser armazenados por uma porta ObjectStorage.

Implementações possíveis:

S3;
Cloudflare R2;
MinIO;
outro serviço compatível.
Pagamentos

Integrações devem utilizar PaymentGateway.

Primeira fase:

PaymentGateway
├── FakePaymentGateway
└── primeiro provider real

Não implementar vários providers reais simultaneamente no MVP.

Escalabilidade

Primeira evolução:

1 API → várias APIs
1 worker → vários workers
PostgreSQL pequeno → PostgreSQL maior
Redis local → Redis gerenciado

Segunda evolução:

worker único
├── worker-payments
├── worker-tickets
├── worker-notifications
└── worker-finance

Extração futura:

inventory-service
payment-service
checkin-service
search-service

Extrações devem ocorrer apenas após evidência de necessidade.

Requisitos não funcionais iniciais
zero overselling;
zero emissão duplicada;
zero check-in duplicado;
zero vazamento entre organizações;
zero perda conhecida de pagamento confirmado;
API preparada para múltiplas instâncias;
graceful shutdown;
health checks;
logs estruturados;
backups;
testes de concorrência.

Estrutura de pastas

Definida em ADR-004. Resumo:

API backend:

```text
apps/api/src/
├── main.ts
├── app.module.ts
├── platform/          — config, database, health, http, messaging, observability, security
├── modules/[module]/  — domain, application, infrastructure, presentation
└── shared/kernel/     — somente elementos realmente compartilhados
```

Frontends:

```text
apps/[web]/src/
├── app/               — rotas Next.js
├── features/[feat]/   — api, components, hooks, schemas, types, tests, index.ts
└── shared/            — api, lib, ui/primitives, ui/composites, ui/sections
```

Tokens de design:

```text
packages/design-tokens/tokens.css — tokens primitivos e semânticos compartilhados
```