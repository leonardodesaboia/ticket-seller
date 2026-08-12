# TASK-035 — Ticket Validation & Admission Engine

## Status

COMPLETED

## Objetivo

Motor puro de decisão de admissão. Recebe um contexto sem IO e retorna um código de decisão estável. Nenhuma persistência nesta tarefa.

## Resultado observável

- `AdmissionPolicy.evaluate(ctx)` retorna `AdmissionDecision` com `code` e `allowed`.
- Os 7 códigos estáveis funcionam isoladamente e em composição.
- Prioridade de avaliação testada explicitamente.
- Nenhuma PII é parte da `AdmissionDecision`.

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-035-ticket-admission-engine.md`
- `docs/modules/tickets.md`
- `apps/api/src/modules/tickets/domain/ticket.entity.ts`
- `apps/api/src/modules/tickets/domain/ticket-credential.entity.ts`
- `apps/api/src/modules/events/domain/event.entity.ts`

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/api/src/modules/tickets/domain/admission/admission-decision.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-context.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-policy.ts`
- `apps/api/src/modules/tickets/domain/admission/admission-policy.spec.ts`
- `apps/api/src/modules/tickets/domain/admission/index.ts`

## Arquivos proibidos

O agente não pode alterar:

- qualquer arquivo fora de `tickets/domain/admission/`;
- módulos não relacionados;
- migrations;
- documentação não relacionada.

## Requisitos funcionais

- `VALID`: credencial ativa + ticket ativo + evento ativo + mesmo evento + sem transferência pendente + sem check-in anterior.
- `INVALID_CREDENTIAL`: credencial nula ou `REVOKED`.
- `TICKET_CANCELLED`: ticket com status `CANCELLED`.
- `WRONG_EVENT`: `ticket.eventId ≠ targetEventId`.
- `EVENT_NOT_ACTIVE`: evento com status diferente de `PUBLISHED`.
- `TRANSFER_PENDING`: `ticket.transferPending === true`.
- `ALREADY_CHECKED_IN`: `alreadyAdmitted === true`.

## Requisitos técnicos

- `AdmissionPolicy` é uma classe pura — sem `@Injectable`, sem IO, sem dependências externas.
- `AdmissionContext` não contém PII (sem email, nome, CPF, telefone).
- `ACTIVE_EVENT_STATUSES` derivado dos valores reais de `event.entity.ts`.
- `ADMISSION` é um objeto imutável com as 7 decisões pré-construídas.

## Invariantes

- `AdmissionDecision.allowed === true` somente para código `VALID`.
- A ordem de avaliação é determinística e testada.
- Nenhum PII retornado na decisão.

## Segurança

- `AdmissionContext.tokenHash` presente para rastreabilidade, mas sem relação com dados pessoais.
- Nenhum campo identificador de pessoa em `AdmissionDecision`.
- Motor não acessa banco — sem risco de injeção.

## Multi-tenancy

Não aplicável diretamente: a policy não acessa banco. O `organizationId` é validado na camada de infraestrutura antes de construir o `AdmissionContext`.

## Concorrência

Não aplicável: `AdmissionPolicy` é stateless e imutável. Pode ser chamada de múltiplas threads simultaneamente sem estado compartilhado.

## Idempotência

Não aplicável: `evaluate()` é função pura — mesmo input sempre produz mesmo output.

## Fora do escopo

- Persistência de resultados (TASK-036).
- Busca de credencial no banco.
- Endpoint HTTP.
- Verificação real de `transferPending` (TASK-038 implementa; por ora sempre `false`).

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 15, cobrindo todos os 7 códigos, prioridade e casos de borda);
- nenhuma dependência adicionada sem justificativa.

## Comandos

```bash
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
```

## Conclusão esperada

### Arquivos alterados

- `apps/api/src/modules/tickets/domain/admission/admission-decision.ts`: criado
- `apps/api/src/modules/tickets/domain/admission/admission-context.ts`: criado
- `apps/api/src/modules/tickets/domain/admission/admission-policy.ts`: criado
- `apps/api/src/modules/tickets/domain/admission/admission-policy.spec.ts`: criado
- `apps/api/src/modules/tickets/domain/admission/index.ts`: criado

### Implementado

- `AdmissionPolicy.evaluate()` pura com 7 códigos de decisão e ordem determinística.

### Testes

```
pnpm test: aprovado (23 unitários)
```

### Decisões

- `ACTIVE_EVENT_STATUSES = new Set(['PUBLISHED'])` — único status ativo confirmado pelo `event.entity.ts`.

### Pendências

`transferPending` sempre `false` até TASK-038.

### Próxima tarefa

TASK-036 — Check-in API & Audit Trail.
