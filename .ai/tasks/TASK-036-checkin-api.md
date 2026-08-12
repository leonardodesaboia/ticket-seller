# TASK-036 — Check-in API & Audit Trail

## Status

COMPLETED

## Objetivo

Implementar endpoint de check-in transacional com prevenção de double check-in por partial unique index e trilha de auditoria completa.

## Resultado observável

- `POST /api/v1/organizations/:orgId/events/:eventId/check-ins` recebe um `credential` (64 hex) e retorna `{ decision, allowed, checkedInAt }`.
- Dois scanners simultâneos do mesmo ticket: um recebe `ADMITTED`, o outro `ALREADY_CHECKED_IN`.
- Replay com mesma `Idempotency-Key` retorna exatamente o resultado original.
- Scan posterior ao primeiro `ADMITTED` retorna `ALREADY_CHECKED_IN`.
- Tabela `check_ins` registra toda tentativa com credencial válida — incluindo recusadas.
- A resposta nunca expõe `tokenHash`, `credentialId`, `orderId` ou `email`.

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-036-checkin-api.md`
- `docs/modules/tickets.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tickets/domain/admission/index.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-policy.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-context.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-decision.ts`
- `apps/api/src/modules/tickets/domain/ticket-credential.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket.entity.ts`
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`
- `apps/api/src/modules/events/domain/event.entity.ts`
- `apps/api/src/platform/actor/actor.guard.ts`
- `apps/api/src/platform/actor/current-actor.decorator.ts`
- `apps/api/test/integration/tickets/public-ticket-credential.integration-spec.ts`

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/api/prisma/migrations/20260812000015_check_ins/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/checkin/domain/check-in.entity.ts`
- `apps/api/src/modules/checkin/domain/ports/check-in-repository.port.ts`
- `apps/api/src/modules/checkin/application/ports/event-access.port.ts`
- `apps/api/src/modules/checkin/application/ports/ticket-access.port.ts`
- `apps/api/src/modules/checkin/application/use-cases/perform-check-in.use-case.ts`
- `apps/api/src/modules/checkin/application/use-cases/perform-check-in.use-case.spec.ts`
- `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts`
- `apps/api/src/modules/checkin/infrastructure/adapters/event-access.adapter.ts`
- `apps/api/src/modules/checkin/infrastructure/adapters/ticket-access.adapter.ts`
- `apps/api/src/modules/checkin/infrastructure/checkin.infrastructure.module.ts`
- `apps/api/src/modules/checkin/presentation/controllers/check-in.controller.ts`
- `apps/api/src/modules/checkin/presentation/dto/check-in.dto.ts`
- `apps/api/src/modules/checkin/checkin.module.ts`
- `apps/api/src/app.module.ts`
- `apps/api/test/integration/checkin/check-in.controller.integration-spec.ts`

## Arquivos proibidos

O agente não pode alterar:

- migrations aplicadas anteriores a `20260812000015`;
- módulos fora de `checkin/` e `app.module.ts`;
- arquivos de `tickets/` (somente leitura para contexto);
- arquivos gerados pelo Prisma (somente regenerar via `prisma generate`);
- lockfile sem instalação aprovada;
- documentação não relacionada.

## Requisitos funcionais

- `POST /api/v1/organizations/:orgId/events/:eventId/check-ins`:
  - Body: `{ credential: "<64hex>", notes?: string }`
  - Header: `Idempotency-Key` (opcional)
  - Response 200: `{ decision: AdmissionCode, allowed: boolean, checkedInAt: string | null }`
- Autenticado por `ActorGuard` (header `X-Dev-User-Id` no dev).
- `decision` segue os 7 códigos estáveis de `AdmissionPolicy`.
- Replay: mesma `Idempotency-Key` → mesmo resultado, sem efeitos colaterais.
- Audit trail: toda tentativa com credencial válida persiste em `check_ins`.
- `INVALID_CREDENTIAL` sem ticket real → não persiste na tabela (sem FK válida).

## Requisitos técnicos

- `PerformCheckInUseCase` usa `AdmissionPolicy` (TASK-035) sem instância via DI.
- Token → hash: `crypto.createHash('sha256').update(token).digest('hex')` no use case.
- `createCheckIn` usa `ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key RETURNING *` para replay seguro.
- `PostgresError 23505` no partial unique index `(ticket_id) WHERE result='ADMITTED'` → transformar em `ALREADY_CHECKED_IN`.
- `ticket-access.adapter` faz JOIN `ticket_credentials → tickets` pelo `token_hash`.
- `transferPending` sempre `false` nesta task (TASK-038 adiciona a verificação real).

## Invariantes

- Partial unique index `(ticket_id) WHERE result='ADMITTED'` é a única fonte de verdade para double check-in.
- Nunca confiar em contagem de aplicação para garantir unicidade — apenas o banco garante.
- Credencial de outra organização nunca encontrada (query filtra `organization_id`).
- Resposta nunca expõe `tokenHash`, `credentialId`, `orderId`, `ticketId` interno ou `email`.

## Segurança

- Token recebido nunca logado.
- Hash calculado no use case — não no controller nem no adapter.
- 401 para ausência de actor (ActorGuard).
- Cross-tenant: `organization_id` filtra evento e credencial — acesso cruzado retorna `INVALID_CREDENTIAL`.
- Nenhum detalhe interno de implementação nas respostas de erro.

## Multi-tenancy

- `organization_id` obrigatório no path (`orgId`).
- `event-access.adapter` filtra `events WHERE id = :eventId AND organization_id = :orgId`.
- `ticket-access.adapter` filtra `ticket_credentials WHERE organization_id = :orgId`.
- Acesso cruzado resulta em `INVALID_CREDENTIAL` (nenhum dado vaza).

## Concorrência

- Dois POSTs simultâneos com mesmo ticket e resultado `ADMITTED`:
  - Partial unique index lança `23505` no segundo INSERT.
  - Use case captura o erro e retorna `ALREADY_CHECKED_IN`.
  - Resultado: exatamente um `ADMITTED` no banco.
- Testado com `Promise.all` contra PostgreSQL real.

## Idempotência

- `Idempotency-Key` opcional no header.
- Se fornecida: `findByIdempotencyKey` antes de qualquer processamento.
- Replay retorna exatamente o resultado original sem re-executar a política.

## Fora do escopo

- Verificação de `transferPending` real (TASK-038).
- Check-in manual sem QR.
- Reversão de check-in.
- Rate limiting por operador.
- Role check além de `ActorGuard` (qualquer actor autenticado pode fazer check-in nesta task).

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 5);
- testes de integração aprovados (mínimo 8, incluindo concorrência com `Promise.all`);
- resposta sem `tokenHash`, `credentialId`, `orderId`, `email`;
- partial unique index testado contra PostgreSQL real;
- nenhuma dependência adicionada sem justificativa.

## Comandos

```bash
cd apps/api && npx prisma generate
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration
pnpm --filter @ticket-seller/api build
```

## Conclusão esperada

### Arquivos alterados

- `apps/api/prisma/migrations/20260812000015_check_ins/migration.sql`: criado
- `apps/api/prisma/schema.prisma`: modelo `CheckIn` adicionado
- `apps/api/src/modules/checkin/`: módulo completo criado
- `apps/api/src/app.module.ts`: `CheckInModule` importado
- `apps/api/test/integration/checkin/check-in.controller.integration-spec.ts`: criado

### Implementado

- Endpoint `POST .../check-ins` com `AdmissionPolicy` + audit trail.
- Double check-in impedido pelo partial unique index.
- Replay por `Idempotency-Key`.

### Testes

```
pnpm test:              aprovado
pnpm test:integration:  aprovado (incluindo concorrência)
```

### Decisões

[a preencher pelo implementador]

### Pendências

`transferPending` sempre `false` até TASK-038.

### Próxima tarefa

TASK-037 — Check-in Operator Interface.
