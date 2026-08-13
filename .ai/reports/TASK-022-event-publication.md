Relatório da TASK-022 — Event Publication

Status

IN_REVIEW (implementação concluída e revisada; aguardando integração/merge)

Data: 2026-08-06

Arquivos alterados

Novos:
- `apps/api/src/modules/events/application/ports/publish-event-operation.port.ts`: port da operação transacional + DTO `PublishedEventData` (transport-safe, sem `onlineInfo`).
- `apps/api/src/modules/events/application/use-cases/publish-event.use-case.ts` (+ `.spec.ts`): authz antes do replay, monta scopedKey escopada ao ator, hash e `now`.
- `apps/api/src/modules/events/infrastructure/adapters/prisma-publish-event-operation.adapter.ts`: transação Serializable com idempotência, `SELECT ... FOR UPDATE` tenant-scoped, recálculo de readiness sob lock, `updateMany` com optimistic lock, outbox, auditoria e cache da resposta.
- `apps/api/src/modules/events/domain/publication/slug.ts`: slugificação (título normalizado + UUID completo), truncada para caber em `VarChar(500)`.
- `apps/api/src/modules/events/presentation/controllers/publish-event.controller.ts`: `POST .../publish`, validação de `Idempotency-Key`, mapeamento de erros 409/422 com `code`/`version`/`issues`.
- `apps/api/src/modules/events/presentation/dto/publish-event.dto.ts`: request `{ version }`.
- `apps/api/test/integration/publish-event.integration-spec.ts`: 14 testes de integração.

Modificados:
- `apps/api/src/modules/events/domain/event.errors.ts`: `EventNotDraftError`, `EventPublicationNotReadyError` (carrega `version` + `issues`).
- `apps/api/src/modules/events/domain/event.entity.ts`, `infrastructure/repositories/prisma-event.repository.ts`, `presentation/dto/event.response.ts`: campos `slug` e `publishedAt` (aditivos).
- `apps/api/src/modules/events/events.module.ts`: fiação do use case, controller e adapter.
- 6 specs unitários `makeEvent` + 3 specs de integração (fixtures que semeavam `PUBLISHED` passaram a incluir `slug`/`publishedAt` para satisfazer a constraint `events_published_fields_check` da migration 005).

Implementado

- Transição atômica e idempotente `DRAFT → PUBLISHED` em uma única transação.
- Autorização (membership ACTIVE + papel OWNER/ADMIN/EVENT_MANAGER) sempre antes de qualquer replay idempotente.
- Readiness recalculada dentro da transação, sob lock da linha do evento, reutilizando a `PublicationReadinessPolicy` da TASK-021.
- Optimistic concurrency por versão; resultado determinístico sob publicação/edição concorrentes (lock + `updateMany where version/status` + guarda `count === 0`).
- Idempotência: replay com mesma chave+payload retorna a resposta confirmada em cache sem duplicar outbox/auditoria nem reincrementar a versão; payload diferente com a mesma chave retorna `409 IDEMPOTENCY_KEY_REUSED`.
- Slug global, imutável e único (título + UUID completo); `publishedAt` gerado no servidor.
- Outbox `event.published.v1` com apenas `eventId`, `organizationId`, `version`, `slug`, `publishedAt`, `startsAt`.
- Auditoria `event.published` (ator, organização, evento, versão, slug, publishedAt) — primeiro uso real de `audit_entries`.
- `onlineInfo` nunca aparece em resposta, outbox, auditoria nem no `responseBody` cacheado (só `onlineConfigured`).

Decisões tomadas

- `PublishedEventData` (DTO de aplicação, plano) é o valor cacheado e retornado, garantindo por construção que `onlineInfo` não vaza; a apresentação usa `EventResponse` apenas para o Swagger.
- Ordem sob lock: `not found` (404) → `not draft` (409 EVENT_NOT_DRAFT) → `version conflict` (409 EVENT_VERSION_CONFLICT) → `not ready` (422), consistente com `updateConfiguration`.
- Chave de idempotência escopada ao ator (`event-publish:<org>:<event>:<actor>:<key>`), divergindo intencionalmente do padrão de ticket-types para impedir que um membro dê replay na resposta de outro (achado ALTO-2 da revisão).
- Catch de `P2002` restrito à constraint da chave de idempotência; outras violações (ex.: `events.slug`) propagam (achado ALTO-1 da revisão).
- Nenhuma migration aplicada foi alterada (a migration 005 já existia).

Testes executados

Comando	Resultado
pnpm typecheck	aprovado
pnpm lint	aprovado
pnpm test (unit: api 119, backoffice 23, marketplace 2)	aprovado
pnpm --filter @ticket-seller/api test:integration (137/137)	aprovado
.ai/scripts/validate-architecture.sh	aprovado
.ai/scripts/validate-migrations.sh	aprovado (nenhuma migration existente modificada)
.ai/scripts/scan-secrets.sh	aprovado
pnpm format:check	reprovado (pré-existente e não relacionado — ver Riscos)

Revisões realizadas

- Revisão técnica + segurança independente (subagente code-reviewer): veredito inicial CHANGES-REQUESTED.
  - ALTO-1 (catch de P2002 amplo) — corrigido.
  - ALTO-2 (chave de idempotência sem ator) — corrigido (+ teste de integração que prova o escopo por-ator).
  - MÉDIO-1 (ordem status-antes-de-versão) — intencional e determinístico; mantido.
  - MÉDIO-2 (Serializable sem retry em 40001/P2034) — mantido por consistência com o adapter de ticket-types; a correção via `FOR UPDATE` + guarda `count === 0` garante a corretude independentemente do nível de isolamento. Retry permanece melhoria futura já registrada no handoff.
  - MÉDIO-3 (duplicata concorrente em andamento retorna 409 em vez de aguardar) — espelha a convenção já aprovada em ticket-types; mantido.
  - BAIXO-3 (comentário do limite de slug) — aplicado.

Riscos identificados

- `pnpm format:check` falha no repositório de forma pré-existente (backoffice inteiro e vários arquivos da API que não foram tocados, ex.: `publication-readiness.policy.ts`). Todos os arquivos novos desta tarefa passam no Prettier. Recomenda-se um passe global de `prettier --write` como tarefa de higiene separada.
- MÉDIO-2/MÉDIO-3 permanecem como itens conhecidos (não bloqueantes), alinhados às convenções e ao handoff.

Pendências

- Integração/merge da TASK-022 (não commitado; aguardando decisão do usuário).
- Atualização final de `docs/CURRENT_STATE.md` e `docs/modules/events.md` (feita nesta entrega).

Documentação atualizada

- `.ai/tasks/TASK-022-event-publication.md`
- `.ai/coordination/ACTIVE_TASKS.md`
- `.ai/coordination/INTEGRATION_QUEUE.md`
- `docs/CURRENT_STATE.md`
- `docs/modules/events.md`

Próxima tarefa recomendada

TASK-023 — Public Event Catalog API (desbloqueada assim que a TASK-022 for integrada e o shape JSON final for congelado).
