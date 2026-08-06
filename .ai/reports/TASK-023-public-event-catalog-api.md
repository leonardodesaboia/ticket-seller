Relatório da TASK-023 — Public Event Catalog API

Status

IN_REVIEW (implementação concluída, revisada e validada; aguardando integração em develop)

Data: 2026-08-06
Branch: task/023-public-event-catalog-api (a partir de develop)

Arquivos alterados

Novos (11):
- `application/ports/public-event-query.port.ts`: port + tipos públicos (list row, detail).
- `application/use-cases/list-public-events.use-case.ts` (+ `.spec.ts`): decodifica cursor opaco e delega.
- `application/use-cases/get-public-event.use-case.ts` (+ `.spec.ts`): 404 via PublicEventNotFoundError.
- `application/errors/public-catalog.errors.ts`: InvalidCursorError, PublicEventNotFoundError.
- `domain/publication/public-cursor.ts`: cursor opaco base64url `startsAt|id` com validação.
- `infrastructure/adapters/prisma-public-event-query.adapter.ts`: consultas sempre `status=PUBLISHED`, sem `onlineInfo`.
- `presentation/controllers/public-events.controller.ts`: controller sem `ActorGuard`, com `Cache-Control`.
- `presentation/dto/public-event.response.ts`: DTOs públicos independentes do administrativo.
- `test/integration/public-events.integration-spec.ts`: 7 testes de integração.

Modificado (1):
- `events.module.ts`: fiação dos use cases, controller e adapter.

Implementado

- `GET /api/v1/public/events?cursor=<opaque>&limit=20` — listagem sem autenticação de eventos `PUBLISHED` em andamento/futuros (`endsAt >= now`), keyset `startsAt ASC, id ASC`, cursor opaco, limite default 20 / máx 100.
- `GET /api/v1/public/events/:slug` — detalhe de evento `PUBLISHED`, acessível inclusive após o término.
- DTO público independente: evento (slug, título, descrição, formato, início, término, timezone, moeda); venue (nome, cidade, estado, país); ticket types apenas ativos (nome, descrição, preço, moeda), ordenados por preço asc.
- `onlineInfo`, endereço completo, IDs, capacidade e versão nunca são selecionados nem apresentados.
- `404` indistinguível entre slug inexistente e evento não publicado.
- `Cache-Control: public, max-age=60, stale-while-revalidate=300` em ambos os endpoints.

Decisões tomadas

- Item da listagem enxuto (sem venue/ticketTypes/preço) — decisão de produto confirmada; detalhe traz o restante.
- Sem `priceFrom` — contrato lista os ticket types ativos individualmente (decisão de produto confirmada; shape congelado).
- Consultas fixam `status='PUBLISHED'` + `slug`/`startsAt` não nulos, garantindo a ordem total do keyset e itens de listagem sempre utilizáveis.
- Ticket types ordenados por `priceAmount asc, name asc` (IDs são UUID aleatórios e não devem guiar a apresentação).
- Clamp de `limit` em `[1,100]` espelhando a convenção da listagem administrativa (`events.controller`); limite malformado cai no default (endpoint público tolerante e cacheável).
- Nenhuma migration: reutiliza o índice parcial `(starts_at, id) WHERE status='PUBLISHED'` da TASK-022.

Testes executados

Comando	Resultado
pnpm typecheck	aprovado
pnpm lint	aprovado
pnpm test (unit: api 124/124)	aprovado
pnpm --filter @ticket-seller/api test:integration (144/144; público 7/7, estável em 3 execuções)	aprovado
prisma validate	aprovado
validate-migrations.sh	aprovado (nenhuma migration existente modificada)
validate-architecture.sh	aprovado
scan-secrets.sh	aprovado
API build	aprovado
git diff --check	aprovado
Prettier (arquivos da tarefa)	aprovado

Revisões realizadas

- Revisão técnica + segurança independente (subagente code-reviewer): veredito CHANGES-REQUESTED (soft), sem BLOQUEANTE/ALTO.
  - MÉDIO-2/BAIXO-4 (keyset frágil se `startsAt`/`slug` nulos) — corrigido (`{ not: null }` no filtro da listagem).
  - MÉDIO-3 (faltava teste de empate em `startsAt` na fronteira de página) — corrigido (teste com 5 eventos de mesmo `startsAt` sem skip/duplicata; ordenação de ticket types por preço para determinismo).
  - MÉDIO-1 (tratamento de `limit`) — mantido o clamp por consistência com a listagem administrativa; comentário adicionado.
  - Invariantes de segurança confirmados: sem auth, PUBLISHED-only, sem vazamento de onlineInfo/endereço/IDs/capacidade, 404 indistinguível, cache headers, cursor opaco com 400 seguro.

Riscos identificados

- Nenhum bloqueante. `format:check` global permanece falho por arquivos pré-existentes fora desta tarefa (não tocados).

Pendências

- Integração da TASK-023 na `develop` (aguardando autorização; sem push, sem main).

Documentação atualizada

- `.ai/tasks/TASK-023-public-event-catalog-api.md`
- `.ai/coordination/ACTIVE_TASKS.md`
- `.ai/coordination/INTEGRATION_QUEUE.md`
- `docs/CURRENT_STATE.md`
- `docs/modules/events.md`

Próxima tarefa recomendada

TASK-024 — Publish Flow and Marketplace (desbloqueia após a TASK-023 ser integrada na develop e o shape público congelado — já congelado nesta tarefa).
