# Fixes Session 3 — 2026-08-24

Continuação da sessão 2. Todos os 439 testes passam após cada fix.

---

## Reservations — underflow em reserved (ALTO)

**Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts`

- Linhas 203 (cancel) e 240 (expire): `reserved = reserved - quantity` sem proteção contra underflow
- O `FOR UPDATE` na reserva evita dupla-decremento para a mesma reserva, mas não contra discrepâncias de dados
- Corrigido: `reserved = GREATEST(reserved - quantity, 0)` em ambos os paths
- Alinhado com a mesma abordagem já usada em `PrismaInventoryRepository.releaseHold()`

---

## Identity — layer violation (ALTO)

4 use-cases injetavam `PrismaService` diretamente na camada de aplicação, quebrando o isolamento de porta/adaptador.

**Novos arquivos criados:**

- `apps/api/src/modules/identity/domain/ports/user.repository.port.ts`
  - Define `IUserRepository` com 5 métodos: `emailExists`, `findUserIdByEmail`, `findIdentityWithCredential`, `findProfile`, `register`
  - Token: `USER_REPOSITORY`

- `apps/api/src/modules/identity/infrastructure/repositories/prisma-user.repository.ts`
  - Implementação de `IUserRepository` usando `PrismaService` (único ponto onde Prisma é usado para acesso a usuários)
  - `findIdentityWithCredential` combina os dois queries originais (identity.findFirst + passwordCredential.findUnique) em sequência
  - `register` mantém a transação atômica (user + identity + passwordCredential)

**Use-cases atualizados (removido PrismaService):**

| Use-case | Antes | Depois |
|---|---|---|
| `authenticate-with-password` | `PrismaService` | `IUserRepository.findIdentityWithCredential()` |
| `register-with-password` | `PrismaService` | `IUserRepository.emailExists()` + `IUserRepository.register()` |
| `request-password-reset` | `PrismaService` | `IUserRepository.findUserIdByEmail()` |
| `get-current-identity` | `PrismaService` | `IUserRepository.findProfile()` |

**Módulo atualizado:**

- `apps/api/src/modules/identity/identity.module.ts`
  - Adicionado `PrismaUserRepository` ao providers
  - Adicionado binding `{ provide: USER_REPOSITORY, useExisting: PrismaUserRepository }`

**Specs atualizados:**

- `authenticate-with-password.use-case.spec.ts` — substituído mock de `PrismaService` por mock de `IUserRepository`
- `register-with-password.use-case.spec.ts` — substituído mock de `PrismaService` por mock de `IUserRepository`

---

## Status dos 439 testes

```
Test Suites: 70 passed, 70 total
Tests:       439 passed, 439 total
```

---

## Problemas restantes documentados (não corrigidos nesta sessão)

### Finance (MÉDIO)
- `settle-order.use-case.ts`: `pending_amount` pode ir negativo se `sellerNetAmount > pending` — adicionar `WHERE pending_amount >= sellerNetAmount` no UPDATE
- `settlement.worker.ts`: drain-loop sem flag `isRunning` — pode processar após shutdown
- `reconciliation.worker.ts`: precisa de `FOR UPDATE SKIP LOCKED` dentro da transação para evitar concorrência

### Identity (MÉDIO)
- `emailVerificationRepository.create` fora da transação de registro — falha parcial possível (usuário criado sem token de verificação)
- `forceReset` flag nunca verificado no login — usuário pode logar sem trocar senha obrigatória
- Index faltando: `[ip, attemptedAt]` em `auth_attempts` — migration necessária

### Organizations (MÉDIO)
- Email não normalizado na criação de convite — `Foo@Bar.com` e `foo@bar.com` são tratados como convites distintos
- Índices compostos faltando em `organization_members` — migration necessária

### Orders (MÉDIO)
- `total_amount` sempre igual a `subtotal_amount` — campo de fee/desconto nunca calculado
- Falha de serialização `40P01` não retentada em alguns paths

### Events/Venues
- Módulo de venues sem testes — ALTO
