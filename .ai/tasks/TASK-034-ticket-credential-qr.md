# TASK-034 — Ticket Credential & QR Foundation

## Status

COMPLETED

## Objetivo

Criar credencial segura e rotacionável por ticket. O token é o único payload do QR Code — nunca PII, preço ou IDs internos.

## Resultado observável

- `POST /api/v1/public/orders/:orderId/tickets/:ticketId/credential` emite um token de 64 chars hex e retorna 201.
- Cada chamada a POST revoga a credencial anterior e emite nova — o token exibido no QR é sempre o mais recente.
- `GET .../credential` informa se há credencial ativa (`hasCredential: boolean`).
- A tabela `ticket_credentials` armazena apenas o SHA-256 do token — o plaintext nunca persiste.
- Somente uma credencial `ACTIVE` pode existir por ticket (partial unique index).

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-034-ticket-credential-qr.md`
- `docs/modules/tickets.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tickets/domain/ticket.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket.errors.ts`
- `apps/api/src/modules/tickets/domain/ports/ticket-repository.port.ts`
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`
- `apps/api/src/modules/tickets/tickets.module.ts`
- `apps/api/src/modules/tickets/infrastructure/adapters/ticket-order-access.adapter.ts`
- `apps/api/test/integration/tickets/public-tickets.controller.integration-spec.ts`

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/api/prisma/migrations/20260812000014_ticket_credentials/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tickets/domain/ticket-credential.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket-credential.errors.ts`
- `apps/api/src/modules/tickets/domain/ports/ticket-credential-repository.port.ts`
- `apps/api/src/modules/tickets/application/use-cases/issue-ticket-credential.use-case.ts`
- `apps/api/src/modules/tickets/application/use-cases/issue-ticket-credential.use-case.spec.ts`
- `apps/api/src/modules/tickets/application/use-cases/get-ticket-credential.use-case.ts`
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts`
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`
- `apps/api/src/modules/tickets/presentation/controllers/public-ticket-credential.controller.ts`
- `apps/api/src/modules/tickets/presentation/dto/credential.response.ts`
- `apps/api/src/modules/tickets/tickets.module.ts`
- `apps/api/test/integration/tickets/public-ticket-credential.integration-spec.ts`

## Arquivos proibidos

O agente não pode alterar:

- migrations aplicadas anteriores a `20260812000014`;
- módulos fora de `tickets/`;
- `apps/api/src/app.module.ts` (exceto para importar `TicketsModule` se necessário);
- arquivos gerados pelo Prisma (somente regenerar via `prisma generate`);
- lockfile sem instalação aprovada;
- documentação não relacionada.

## Requisitos funcionais

- `POST .../credential`: emite novo token (64 hex) e revoga credencial anterior se houver.
- `GET .../credential`: retorna `{ hasCredential: boolean, ticketId }` — não retorna o token (não armazenado).
- Acesso autenticado por `X-Reservation-Token` (SHA-256 comparado com `reservations.continuation_token_hash`).
- Ticket cancelado → 409 com código `TICKET_CANCELLED`.
- Token de reserva inválido ou ticket de outro order → 401.
- Ticket não encontrado no order → 401 (não revelar existência).

## Requisitos técnicos

- Token gerado com `crypto.randomBytes(32).toString('hex')` — 64 chars hex.
- `token_hash = SHA-256(token)` — único campo persistido; plaintext descartado após retorno.
- `rotateCredential` usa `$transaction` sequencial (UPDATE revoke → INSERT new) — não CTE com múltiplos data-modifying statements (PostgreSQL não garante ordem de visibilidade em CTE).
- `createIfNoneActive` usa `INSERT ... ON CONFLICT (ticket_id) WHERE status='ACTIVE' DO NOTHING`.
- Partial unique index `(ticket_id) WHERE status='ACTIVE'` garante no máximo uma credencial ativa por ticket.
- `UNIQUE(token_hash)` protege contra colisão improvável de hash.

## Invariantes

- `credentialToken` (plaintext) nunca é armazenado no banco — apenas `token_hash`.
- `token_hash` nunca aparece em response de API.
- No máximo uma credencial `ACTIVE` por ticket.
- Credencial pertence à organização do ticket.
- Token nunca contém PII, preço, `orderId` ou `organizationId`.

## Segurança

- Token gerado com `crypto.randomBytes` — imprevisível.
- `token_hash` nunca logado nem exposto.
- `credentialToken` retornado uma única vez no POST; não armazenável pelo servidor.
- 401 genérico para qualquer falha de autorização — não revelar qual campo falhou.
- QR payload = apenas `credentialToken` (64 hex).

## Multi-tenancy

- `organization_id` obrigatório na tabela `ticket_credentials`.
- Consultas filtram por `organization_id` além de `ticket_id`.
- Credencial de outra organização não é encontrada pelo token.

## Concorrência

- Dois POSTs simultâneos para o mesmo ticket: um `createIfNoneActive` retorna nulo (conflito no index), cai no fallback de `rotateCredential` — resultado: uma credencial ativa.
- Partial unique index é a fonte de verdade — nunca lógica de aplicação.

## Idempotência

- Cada POST gera novo token (design deliberado — token não é reutilizável sem novo POST).
- GET não cria nem altera estado.

## Fora do escopo

- QR visual (imagem PNG/SVG).
- Apple Wallet / Google Wallet.
- NFC.
- Expiração automática de credencial.
- Validação do token no check-in (TASK-036).

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 5);
- testes de integração aprovados (mínimo 8, incluindo concorrência);
- `token_hash` ausente de todas as respostas;
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

- `apps/api/prisma/migrations/20260812000014_ticket_credentials/migration.sql`: criado
- `apps/api/prisma/schema.prisma`: modelo `TicketCredential` adicionado
- `apps/api/src/modules/tickets/domain/ticket-credential.entity.ts`: criado
- `apps/api/src/modules/tickets/domain/ticket-credential.errors.ts`: criado
- `apps/api/src/modules/tickets/domain/ports/ticket-credential-repository.port.ts`: criado
- `apps/api/src/modules/tickets/application/use-cases/issue-ticket-credential.use-case.ts`: criado
- `apps/api/src/modules/tickets/application/use-cases/issue-ticket-credential.use-case.spec.ts`: criado
- `apps/api/src/modules/tickets/application/use-cases/get-ticket-credential.use-case.ts`: criado
- `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-credential.repository.ts`: criado
- `apps/api/src/modules/tickets/infrastructure/tickets.infrastructure.module.ts`: atualizado
- `apps/api/src/modules/tickets/presentation/controllers/public-ticket-credential.controller.ts`: criado
- `apps/api/src/modules/tickets/presentation/dto/credential.response.ts`: criado
- `apps/api/src/modules/tickets/tickets.module.ts`: atualizado
- `apps/api/test/integration/tickets/public-ticket-credential.integration-spec.ts`: criado

### Implementado

- Credencial segura com rotação: cada POST emite novo token, revogando anterior.
- Plaintext nunca armazenado; apenas SHA-256.
- Endpoints POST e GET com autenticação por token de reserva.

### Testes

```
pnpm test:              aprovado (7 unitários)
pnpm test:integration:  aprovado (10 integração, incluindo concorrência)
```

### Decisões

- Cada POST rotaciona: token não é armazenável — cada scan do comprador gera novo token.
- `$transaction` sequencial em vez de CTE para atomicidade correta na rotação.

### Pendências

Nenhuma.

### Próxima tarefa

TASK-035 — Ticket Validation & Admission Engine.
