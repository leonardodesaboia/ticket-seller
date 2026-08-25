# Revisão de Módulo — events + venues

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

Os módulos `events` e `venues` implementam criação, publicação e cancelamento de eventos. A análise encontrou **1 crítico**, **5 altos**, **12 médios** e **4 baixos**. O problema mais grave é a ausência completa de verificação de autorização no cancelamento de eventos, permitindo que qualquer usuário autenticado cancele eventos de qualquer organização.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `cancel-event.use-case.ts`: Sem verificação de autorização por role
- **Arquivo:** `apps/api/src/modules/events/application/use-cases/cancel-event.use-case.ts`
- **Problema:** O use case não verifica se o `actorId` tem permissão para cancelar o evento. Qualquer usuário autenticado que conheça `eventId` e `organizationId` pode cancelar eventos de terceiros. `PublishEventUseCase` verifica `EVENT_CREATOR_ROLES` — cancelamento ignora completamente autorização.
- **Correção:** Injetar `IOrganizationAccessPort` e verificar role do ator antes de prosseguir.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `prisma-event-cancellation.repository.ts`: N+1 de queries para credenciais de tickets
- **Problema:** Para cada ticket dentro de cada pedido `TICKETS_ISSUED`, executa um `UPDATE ticket_credentials` individual + um `INSERT INTO outbox_events` individual. 5000 tickets = ~10000 queries em uma transação, causando timeout.
- **Correção:** Bulk UPDATE com `WHERE ticket_id = ANY(ARRAY[...]::uuid[])` e INSERT multi-row.

#### A2 — `prisma-event-cancellation.repository.ts`: `cancelledAt` retornado fora da transação
- **Problema:** `const cancelledAt = new Date()` é capturado FORA da transação. O timestamp real do banco (NOW()) pode diferir, causando divergência entre resposta da API e dado persistido.
- **Correção:** Usar `RETURNING cancelled_at` do UPDATE e retornar esse valor.

#### A3 — Testes ausentes: `CancelEventUseCase` sem cobertura de autorização
- **Problema:** Como autorização está ausente no use case, testes também não cobrem. Nenhum teste para "ator sem permissão não pode cancelar".

#### A4 — `prisma-event-cancellation.repository.ts`: `FOR UPDATE SKIP LOCKED` pode ignorar orders durante cancelamento
- **Problema:** Orders bloqueadas por outra transação (ex: pagamento em processamento) são puladas. Em cancelamento de evento, onde corretude é crítica, orders podem escapar.
- **Correção:** Usar `FOR UPDATE` sem `SKIP LOCKED` para bloquear até processar.

#### A5 — Sem testes no módulo venues
- **Problema:** Zero testes para `CreateVenueUseCase`, `ListOrganizationVenuesUseCase`, repositório e controller.

---

### MÉDIO

#### M1 — `update-event-configuration.use-case.ts`: `onlineInfo: null` passa no DTO mas falha no use case
- **Problema:** `@ValidateIf(value => value !== undefined)` pula validação para `null`. Cliente recebe erro 422 genérico do use case em vez de mensagem clara do DTO.
- **Correção:** Adicionar `@IsNotEmpty()` no nível de DTO para rejeitar `null` explicitamente.

#### M2 — `prisma-event.repository.ts`: `updateMany` lança `EventVersionConflictError` incorreto
- **Problema:** Se evento não está em DRAFT (race condition: outro request publicou), `updateMany` retorna `count = 0` e lança `EventVersionConflictError` — mas o erro correto seria `EventNotDraftError`.

#### M3 — `create-ticket-type.use-case.ts`: `actorId` ausente do `requestHash`
- **Problema:** Dois atores diferentes com a mesma `idempotencyKey` e mesmo payload compartilham o mesmo replay, vazando resposta de criação entre atores da mesma organização.
- **Correção:** Incluir `actorId` no hash, como faz `publish-event.use-case.ts`.

#### M4 — `prisma-create-ticket-type-operation.adapter.ts`: `isUniqueConstraintError` permissivo demais
- **Problema:** Verifica apenas `error.code === 'P2002'` sem checar se é violation de idempotency. Violação de `name` unique seria tratada como idempotency replay retornando resposta incorreta.
- **Correção:** Adicionar `error.meta?.target?.includes('idempotency')` como faz o publish adapter.

#### M5 — `create-ticket-type.dto.ts`, `update-ticket-type.dto.ts`: `description` sem `@MaxLength`
- **Correção:** `@MaxLength(5000)`.

#### M6 — `update-event-configuration.dto.ts`: `currency` sem `@IsUppercase()`
- **Correção:** `@IsUppercase()` antes de `@Length(3, 3)`.

#### M7 — `create-venue.dto.ts`: `address` sem `@MaxLength`
- **Correção:** `@MaxLength(500)`.

#### M8 — `create-venue.use-case.ts`: Importa erros e roles de `events` — acoplamento entre módulos
- **Problema:** Módulo venues depende diretamente do domínio de events para erros de autorização.
- **Correção:** Criar módulo `shared/iam` com definições de roles e erros de autorização.

#### M9 — `prisma-venue.repository.ts`: `findByOrganization` sem paginação
- **Problema:** Retorna todos os venues sem limite. Organizações com muitos venues retornam tudo.
- **Correção:** Adicionar limit/cursor como padrão do restante do codebase.

#### M10 — `publish-event.controller.ts`: `OrganizationAccessDeniedError` sem `code` estruturado
- **Correção:** `throw new NotFoundException({ message: err.message, code: 'ORGANIZATION_ACCESS_DENIED' })`.

#### M11 — `events.controller.ts`: `parseInt(limitStr, 10) || 20` depende de comportamento implícito
- **Correção:** Usar `isNaN(parsed) ? 20 : Math.min(Math.max(parsed, 1), 100)`.

#### M12 — `publication-readiness.policy.ts`: `startsAt` no passado não validado
- **Problema:** É possível publicar evento que começa no passado mas termina no futuro.

---

### BAIXO

#### B1 — `event.entity.ts`: `status` e `format` como `string` em vez de enums
#### B2 — `create-venue.dto.ts`: `country` sem `@IsISO31661Alpha2()`
#### B3 — `event.errors.ts`: Duplicação de `EventNotFoundError` entre dois arquivos
#### B4 — `publication-readiness.policy.ts`: Sem limite máximo de `priceAmount`

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| C1 | `cancel-event.use-case.ts`: autorização adicionada — injeta `IOrganizationAccessPort`, verifica se `actorId` é membro ativo com role em `EVENT_CREATOR_ROLES`. Lança `OrganizationAccessDeniedError` se não autorizado. `cancelledAt` capturado via `RETURNING` da transação. Specs atualizadas. | `cancel-event.use-case.ts`, `prisma-event-cancellation.repository.ts`, spec |
| A1 | `prisma-event-cancellation.repository.ts`: revogação de credenciais em batch UPDATE (`WHERE ticket_id = ANY(ARRAY[...]::uuid[])`). Outbox INSERT em bulk. | `prisma-event-cancellation.repository.ts` |
| A2 | `cancelledAt` agora capturado do `RETURNING cancelled_at` dentro da transação. | `prisma-event-cancellation.repository.ts` |

**Pendente:**
- A4: `FOR UPDATE SKIP LOCKED` no cancelamento de evento (orders em processamento podem ser puladas)
- A5: Zero testes no módulo venues
- M2: `updateMany` lança `EventVersionConflictError` incorreto quando status mudou
- M3: `actorId` ausente do `requestHash` em `create-ticket-type`
- M4: `isUniqueConstraintError` permissivo demais no adapter
- M9: `findByOrganization` sem paginação em venues
- M12: `startsAt` no passado não validado na publication readiness
