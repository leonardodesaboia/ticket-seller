# TASK-022 — Event Publication

## Status

COMPLETED (integrada em develop, commit 26a0a72, 2026-08-06)

## Checkpoint de 2026-08-06

Operação de publicação implementada com TDD: use case, port/adapter
transacional, controller, DTO, slug e erros. Todos os testes unitários e de
integração passam (137/137 na API). Revisão técnica/segurança independente
executada; os dois achados ALTO (catch de P2002 restrito à chave de
idempotência; chave de idempotência escopada ao ator) foram corrigidos.
Relatório final em `.ai/reports/TASK-022-event-publication.md`.

## Checkpoint de 2026-07-29

A fundação de banco e o suporte seguro a extensões RFC 9457 foram implementados
e validados. O caso de uso/adapter/controller de publicação ainda não foi
implementado. O estado completo para retomada está em
`.ai/reports/EXECUTION-HANDOFF-2026-07-29-publication-phase.md`.

## Objetivo

Implementar a transição atômica e idempotente `DRAFT → PUBLISHED`.

## Dependências

TASK-021.

## Database Owner exclusivo

Somente o Database Owner desta tarefa pode alterar:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260729000005_event_publication/`

## Contrato congelado

```text
POST /api/v1/organizations/:organizationId/events/:eventId/publish
Idempotency-Key: <non-empty>
Body: { "version": 4 }
```

Sucesso `200`: evento administrativo com `status=PUBLISHED`, nova versão, slug
global e `publishedAt`.

Erros:

- `409 EVENT_VERSION_CONFLICT`
- `409 EVENT_NOT_DRAFT`
- `409 IDEMPOTENCY_KEY_REUSED`
- `422 EVENT_PUBLICATION_NOT_READY` com `version` e `issues`
- erros UUID/auth/tenant conforme convenção existente.

## Migration aditiva

- `events.published_at TIMESTAMPTZ NULL`;
- constraint de status documentado;
- `PUBLISHED` exige `slug` e `published_at`;
- índice parcial `(starts_at, id) WHERE status = 'PUBLISHED'`;
- preservar a unicidade global existente de slug;
- nenhuma migration aplicada será alterada.

## Regras e invariantes

- organização e membership devem continuar `ACTIVE` no momento da operação;
- somente OWNER, ADMIN e EVENT_MANAGER podem publicar;
- autorização ocorre antes de qualquer replay idempotente;
- outsider/cross-tenant recebe `404` e papel insuficiente recebe `403`;
- readiness recalculada dentro da transação pela policy da TASK-021;
- versão obrigatória e optimistic concurrency;
- `publishedAt` gerado no servidor;
- slug: título normalizado + UUID completo, global e imutável;
- atualização, outbox, auditoria e idempotência na mesma transação;
- repetição após resposta perdida retorna a resposta confirmada;
- publicação e alteração concorrentes têm resultado determinístico;
- mutações de ticket type e publicação usam protocolo comum de bloqueio da linha
  do evento e revalidam `DRAFT` dentro da transação;
- evento publicado fica congelado para edição nesta fase.

## Outbox

`event.published.v1` contém apenas `eventId`, `organizationId`, versão, slug,
`publishedAt` e `startsAt`. Nunca inclui `onlineInfo` ou endereço.

## Auditoria

Criar `event.published` com ator, organização, evento, versão, slug e
`publishedAt`, sem dados privados.

## Testes obrigatórios

Sucesso, readiness incompleta, versão, estado, replay, payload diferente,
resposta perdida, concorrência, rollback, outbox, auditoria, cross-tenant,
permissão, UUID, slug, timestamp e ausência de configuração online/ticket type.

## Fora do escopo

Outros estados, edição pós-publicação, notificações, compras e deploy.
