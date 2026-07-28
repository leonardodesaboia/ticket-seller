# FILE: AGENTS.md

# Marketplace de Ingressos — Instruções para Agentes

## 1. Objetivo do projeto

Este repositório contém um marketplace multi-tenant para criação, divulgação, venda, gestão e validação de ingressos.

O produto deve começar como um monólito modular, preparado para:

* até 100 usuários ativos simultaneamente no MVP;
* múltiplas organizações e produtores;
* escalabilidade horizontal;
* processamento assíncrono;
* substituição de serviços externos por adapters;
* extração gradual de módulos para serviços independentes;
* integração futura com provedores como Stripe, Asaas, PagBank, Pagar.me ou outros.

A aplicação não deve ser construída como um protótipo descartável. O MVP deve ser pequeno em infraestrutura e funcionalidades, mas preservar segurança, consistência e organização arquitetural.

---

## 2. Fontes oficiais

Antes de trabalhar, consulte somente as fontes relacionadas à tarefa.

* Produto: `docs/PROJECT.md`
* Domínio: `docs/DOMAIN.md`
* Arquitetura: `docs/ARCHITECTURE.md`
* Estrutura do repositório: `docs/REPOSITORY_MAP.md`
* Estado atual: `docs/CURRENT_STATE.md`
* Decisões arquiteturais: `docs/decisions/`
* Documentação dos módulos: `docs/modules/`
* Tarefas: `.ai/tasks/`
* Relatórios concluídos: `.ai/reports/`
* Workflows: `.ai/workflows/`

Quando houver conflito, prevalece:

1. ADR mais recente e aceito;
2. `AGENTS.md`;
3. documentação oficial;
4. README do módulo;
5. descrição da tarefa.

Uma conversa com IA nunca é considerada fonte oficial do projeto.

---

## 3. Stack oficial

### Linguagem

* TypeScript;
* modo `strict`;
* Node.js LTS;
* código, nomes técnicos e identificadores em inglês;
* documentação de produto pode ser escrita em português.

### Frontend

* React;
* Next.js;
* App Router;
* Tailwind CSS;
* shadcn/ui;
* React Hook Form;
* Zod;
* TanStack Query para estado remoto no cliente;
* OpenAPI para geração do cliente da API.

### Backend

* NestJS;
* Fastify;
* REST;
* OpenAPI;
* RFC 9457 para respostas de erro;
* PostgreSQL;
* Prisma para operações comuns;
* SQL nativo para concorrência, estoque, ledger e operações críticas;
* Redis para cache, rate limiting e dados temporários;
* filas acessadas por ports;
* object storage acessado por ports;
* OpenTelemetry;
* Pino para logs estruturados.

### Infraestrutura

* Docker;
* Docker Compose no desenvolvimento;
* containers OCI;
* aplicações stateless;
* Terraform ou OpenTofu;
* CI/CD;
* serviços gerenciados em produção quando conveniente.

---

## 4. Arquitetura oficial

O projeto utiliza:

* monólito modular;
* arquitetura hexagonal;
* ports and adapters;
* DDD pragmático;
* transactional outbox;
* consumidores idempotentes;
* máquinas de estado;
* CQRS apenas quando necessário;
* anti-corruption layer nas integrações externas.

Direção permitida das dependências:

```text
presentation → application → domain

infrastructure → application
infrastructure → domain
```

O domínio não pode depender de:

* NestJS;
* Fastify;
* Prisma;
* Redis;
* SDKs de nuvem;
* SDKs de pagamento;
* bibliotecas HTTP;
* detalhes de banco de dados.

---

## 5. Organização dos módulos

Os módulos devem representar capacidades de negócio.

Módulos previstos:

```text
identity
organizations
users
events
venues
inventory
reservations
orders
payments
tickets
ticket-transfers
checkin
finance
payouts
notifications
antifraud
audit
administration
```

Estrutura recomendada:

```text
module/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── errors/
│   └── ports/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── use-cases/
│   └── dto/
├── infrastructure/
│   ├── persistence/
│   ├── providers/
│   ├── queues/
│   └── mappers/
├── presentation/
│   ├── controllers/
│   ├── guards/
│   └── presenters/
└── module.ts
```

Não criar arquivos ou pastas vazias apenas para antecipar funcionalidades.

---

## 6. Regras de domínio

* Regras de negócio não podem ficar em controllers.
* Controllers devem validar a entrada, chamar casos de uso e apresentar a resposta.
* Entidades de domínio não são DTOs.
* DTOs não são modelos de banco.
* Modelos do Prisma não podem ser retornados diretamente pela API.
* Estados devem mudar por métodos ou casos de uso explícitos.
* Não alterar propriedades críticas diretamente.
* Não criar `GenericRepository<T>` universal.
* Repositories devem representar operações reais do domínio.

Exemplo correto:

```typescript
interface InventoryRepository {
  tryReserve(input: TryReserveInventoryInput): Promise<ReservationResult>;
  confirmReservation(reservationId: string): Promise<void>;
  releaseExpiredReservation(reservationId: string): Promise<void>;
}
```

---

## 7. Multi-tenancy

Todo recurso pertencente a um produtor deve possuir `organizationId`.

Aplicável a:

* eventos;
* locais;
* lotes;
* pedidos;
* ingressos;
* pagamentos;
* cupons;
* participantes;
* check-ins;
* relatórios;
* repasses;
* arquivos;
* logs de auditoria.

Regras obrigatórias:

* toda consulta multi-tenant deve receber `organizationId`;
* não buscar recurso somente pelo ID público;
* a autorização deve verificar organização, usuário, papel, recurso e ação;
* uma organização nunca pode consultar recursos de outra;
* toda nova funcionalidade multi-tenant deve ter teste de isolamento;
* identificadores públicos não substituem autorização.

Exemplo correto:

```typescript
findOrder(
  organizationId: string,
  orderId: string,
): Promise<Order | null>;
```

Exemplo proibido:

```typescript
findOrder(orderId: string): Promise<Order | null>;
```

---

## 8. Estoque e concorrência

PostgreSQL é a fonte oficial do estoque.

Redis pode ser utilizado para:

* cache;
* contadores aproximados;
* rate limiting;
* expiração auxiliar;
* dados temporários.

Redis não pode ser a única fonte de:

* estoque;
* reservas;
* pagamentos;
* ingressos;
* saldo;
* check-in.

Invariantes:

* estoque disponível nunca pode ficar negativo;
* nenhuma unidade pode ser vendida duas vezes;
* reserva expirada não pode ser confirmada;
* confirmação repetida não pode duplicar a venda;
* cancelamento e pagamento concorrentes devem possuir resultado determinístico;
* operações críticas devem usar transação, constraint ou atualização atômica.

Toda alteração relevante em estoque deve possuir teste de concorrência.

---

## 9. Valores financeiros

* valores monetários devem ser inteiros na menor unidade da moeda;
* nunca utilizar `float`, `double` ou valores decimais binários para dinheiro;
* moeda deve ser informada explicitamente;
* toda movimentação financeira deve ser auditável;
* lançamentos do ledger não devem ser alterados ou apagados;
* ajustes devem gerar novos lançamentos;
* pagamentos, reembolsos e repasses devem ser idempotentes;
* saldo exibido deve ser reconstruível pelos lançamentos.

Exemplo:

```typescript
type Money = {
  amount: bigint;
  currency: 'BRL';
};
```

---

## 10. Pagamentos

O domínio não pode conhecer Stripe, Asaas, PagBank, Pagar.me ou qualquer outro PSP.

Integrações devem implementar uma porta semelhante a:

```typescript
interface PaymentGateway {
  readonly provider: PaymentProvider;

  getCapabilities(): PaymentCapabilities;

  createPayment(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult>;

  getPayment(
    externalPaymentId: string,
  ): Promise<ExternalPayment>;

  refund(
    input: RefundPaymentInput,
  ): Promise<RefundResult>;

  cancel(
    input: CancelPaymentInput,
  ): Promise<CancelPaymentResult>;

  verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedPaymentEvent>;
}
```

Regras:

* SDK do PSP somente dentro do adapter correspondente;
* status externo deve ser traduzido para status interno;
* payload externo não deve virar modelo interno;
* capacidades específicas devem ser declaradas;
* somente um PSP real será implementado inicialmente;
* o desenvolvimento deve utilizar `FakePaymentGateway`;
* nenhuma informação completa de cartão ou CVV deve passar pelo backend.

---

## 11. Webhooks e idempotência

Todo webhook deve:

1. preservar o corpo bruto quando necessário;
2. validar assinatura;
3. registrar o evento recebido;
4. verificar duplicidade;
5. responder rapidamente;
6. encaminhar o processamento para fila;
7. ser processado de maneira idempotente.

Criar índices únicos para identificadores externos relevantes.

Operações que exigem idempotência:

* criação de pedido;
* criação de cobrança;
* confirmação de pagamento;
* reembolso;
* cancelamento;
* emissão de ingresso;
* transferência;
* check-in;
* repasse;
* processamento de mensagens.

Repetir a mesma operação deve retornar o resultado anterior ou um resultado equivalente, sem duplicar efeitos.

---

## 12. Processamento assíncrono

A API não deve executar tarefas pesadas durante a requisição.

Devem ir para workers:

* geração de PDF;
* envio de e-mail;
* envio de WhatsApp;
* exportações;
* relatórios;
* processamento de imagens;
* indexação de busca;
* analytics;
* conciliações demoradas.

Mensagens devem possuir:

* `id`;
* `type`;
* `version`;
* `source`;
* `occurredAt`;
* `organizationId`, quando aplicável;
* `data`.

Mensagens podem ser entregues mais de uma vez.

Consumidores devem ser idempotentes.

Falhas repetidas devem ir para uma dead-letter queue.

---

## 13. Segurança

* nunca registrar senha, token, secret, CVV ou cartão completo;
* nunca colocar secrets no código;
* toda entrada externa deve ser validada;
* utilizar limites de payload;
* endpoints sensíveis devem ter rate limiting;
* alterações bancárias e financeiras exigem autenticação reforçada;
* ações administrativas relevantes devem gerar auditoria;
* uploads devem usar object storage e URLs assinadas;
* não confiar em identificadores enviados pelo frontend;
* não expor stack traces em produção;
* respostas de autenticação não devem facilitar enumeração de usuários;
* permissões devem ser verificadas no backend.

---

## 14. Logs e observabilidade

Logs devem ser estruturados.

Campos recomendados:

```text
requestId
traceId
userId
organizationId
eventId
orderId
paymentId
ticketId
durationMs
```

Não registrar corpos completos de requisições sensíveis.

Toda operação crítica deve possuir métricas.

Exemplos:

```text
active_reservations
reservation_failures
payments_pending
duplicate_webhooks
outbox_pending_events
ticket_issuance_duration
duplicate_checkins
database_pool_usage
```

---

## 15. Regras de banco de dados

* migrations são versionadas;
* migrations aplicadas nunca são alteradas;
* cada mudança deve criar uma nova migration;
* constraints devem proteger invariantes sempre que possível;
* índices devem ser baseados em consultas reais;
* não criar índices indiscriminadamente;
* operações críticas devem ser testadas com PostgreSQL real;
* não utilizar SQLite para simular comportamento concorrente do PostgreSQL;
* consultas grandes devem ser paginadas;
* evitar `SELECT *`;
* evitar transações longas;
* relatórios pesados não devem bloquear o banco transacional.

---

## 16. Regras de frontend

* frontend nunca acessa banco diretamente;
* estoque exibido no frontend é apenas informativo;
* confirmação real ocorre no backend;
* frontend não contém regras financeiras oficiais;
* contratos vêm da API/OpenAPI;
* não compartilhar Prisma Client com frontend;
* não compartilhar entidades de domínio com frontend;
* estado remoto deve ser tratado como estado remoto;
* não usar Redux sem necessidade comprovada;
* componentes de PSP devem ficar isolados por provider;
* acessibilidade deve ser considerada desde o início.

---

## 17. Regras para agentes de IA

Antes de alterar código, o agente deve:

1. ler este arquivo;
2. ler a tarefa correspondente;
3. ler somente os arquivos indicados;
4. apresentar plano curto;
5. listar arquivos que pretende alterar;
6. identificar riscos;
7. identificar invariantes;
8. indicar testes necessários.

O agente não deve:

* ler o repositório inteiro sem necessidade;
* alterar arquivos fora do escopo;
* criar funcionalidades não solicitadas;
* realizar refatorações oportunistas;
* trocar bibliotecas sem ADR;
* instalar dependências sem justificar;
* modificar migrations aplicadas;
* reescrever documentação não relacionada;
* ignorar testes quebrados;
* remover validações para fazer o build passar;
* utilizar `any` sem justificativa;
* criar abstrações sem uso concreto;
* duplicar uma fonte oficial existente.

Caso seja necessário alterar um arquivo fora do escopo, o agente deve parar e explicar a necessidade.

---

## 18. Modos de trabalho

### PLAN

* não alterar arquivos;
* ler somente o contexto indicado;
* apresentar plano;
* listar arquivos;
* identificar riscos;
* listar testes.

### IMPLEMENT

* executar somente o plano aprovado;
* alterar apenas arquivos permitidos;
* não aumentar o escopo;
* executar validações relacionadas.

### REVIEW

* revisar somente o diff;
* não alterar arquivos;
* classificar problemas como:

  * bloqueante;
  * alto;
  * médio;
  * baixo;
* verificar:

  * segurança;
  * concorrência;
  * multi-tenancy;
  * idempotência;
  * arquitetura;
  * testes.

### FIX

* corrigir somente problemas aprovados;
* não realizar novas refatorações;
* reexecutar validações afetadas.

---

## 19. Validação

Comandos gerais esperados:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Não executar toda a suíte quando houver comando confiável e específico para o módulo.

Testes obrigatórios por categoria:

* estoque: concorrência;
* pagamentos: idempotência e webhook duplicado;
* multi-tenancy: acesso cruzado;
* check-in: leitura simultânea;
* banco: PostgreSQL real;
* adapters: testes de contrato;
* API pública: testes de contrato/OpenAPI.

---

## 20. Formato de conclusão

Ao concluir, informar:

1. arquivos alterados;
2. comportamento implementado;
3. decisões tomadas;
4. testes executados;
5. resultado dos testes;
6. riscos;
7. pendências;
8. documentação atualizada;
9. próxima tarefa recomendada.

Não repetir arquivos completos na resposta final.

---

## 21. Princípio central

A IA nunca deve precisar redescobrir uma decisão já tomada.

Decisões permanentes devem ser registradas em documentação ou ADR.

Regras críticas devem ser protegidas por:

* testes;
* constraints;
* lint;
* análise arquitetural;
* validações de CI.
