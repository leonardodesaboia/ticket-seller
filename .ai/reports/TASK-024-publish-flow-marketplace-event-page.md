Relatório da TASK-024 — Publish Flow and Marketplace Event Page

Status

CONCLUÍDA. Branch: task/024-publish-flow-marketplace (a partir de develop). Pronta para integração na develop.

Decisões aprovadas

- Marketplace renderizado como Server Components (SEO/metadata/canonical + cache público).
- Uma única branch sequencial para os dois frontends.
- Contratos consumidos já congelados (TASK-021/022/023); nenhum backend/schema/migration alterado.
- Hooks TanStack Query mockados no nível do módulo nos testes do painel — elimina necessidade de QueryClientProvider real em jsdom.
- onError do mutate reseta confirming para evitar exibição simultânea de erro e diálogo de confirmação.

Arquivos alterados

Marketplace (apps/marketplace-web/src/):
- shared/api/public-events.api.ts: cliente público tipado (list + detail; null em 404; revalidate 60s).
- shared/lib/money.ts (+ .test.ts): formatCurrency BRL (normaliza NBSP).
- shared/lib/event-format.ts: formatEventFormat + formatDateTime (timezone do evento).
- features/public-event-catalog/ (CatalogHome, EventList, EventCard, index) + testes.
- features/public-event-details/ (EventDetails, index) + teste; key composta (name+index) nos ticket types.
- app/page.tsx (home, force-dynamic), app/events/[slug]/{page.tsx (generateMetadata+canonical, notFound), not-found.tsx, loading.tsx}.
- app/layout.tsx: metadataBase. app/page.test.tsx atualizado.

Backoffice (apps/backoffice-web/src/):
- features/publication-readiness/ (types, api, hook, lib/issue-catalog, PublicationChecklist, index) + teste do checklist.
- features/publish-event/ (lib/idempotency + spec, api/publish.api com PublishError problem+json, hook, PublishEventPanel + correção onError, index).
- features/publish-event/components/PublishEventPanel.test.tsx: 13 testes cobrindo loading, erro de rede, não-pronto, pronto, confirmação, cancelar, mutate, idempotência, pending, 409, 422, rede, reset-confirming-on-error.
- shared/test-utils/render-with-client.tsx: helper QueryClientProvider para testes futuros.
- app/organizations/[organizationId]/events/[eventId]/page.tsx: compõe PublishEventPanel em DRAFT.

Infraestrutura de testes:
- jest.config.ts: moduleNameMapper explícito para @/ (nextJest não resolvia alias via tsconfig extends de pacote interno).
- jest.setup.ts: polyfill crypto.randomUUID para jsdom v20.

Implementado

- Marketplace: home lista publicados; detalhe /events/[slug] com título, descrição, formato, datas, timezone, venue público e tipos ativos, preço BRL, mensagem de compra indisponível, metadata+canonical, 404 amigável; nenhum dado privado (onlineInfo/IDs/capacidade) renderizado.
- Backoffice: checklist consumindo códigos/mensagens do backend (sem duplicar regras), links por seção, fallback para código desconhecido; publicação com chave idempotente estável por operação, guarda de duplo clique, tratamento de 409/422/rede/sucesso, invalidação de caches, confirmação inline acessível, reset do diálogo de confirmação em caso de erro.

Testes executados

Comando	Resultado
marketplace typecheck/lint/test/build	aprovado (test 10/10)
backoffice typecheck/lint/test/build	aprovado (test 42/42)

Revisão independente

Executada. Problema alto corrigido: confirming não resetado em onError (exibia erro e diálogo simultaneamente).
Problema médio corrigido: key React usando ticketType.name sem unicidade garantida — substituído por name+index.

Pendências

- Integração na develop (aguardando autorização; sem push, sem main).

Documentação atualizada

- .ai/tasks/TASK-024-publish-flow-marketplace-event-page.md
- .ai/coordination/ACTIVE_TASKS.md
- docs/CURRENT_STATE.md

Próxima etapa recomendada

Fast-forward na develop com autorização do usuário, então iniciar próxima tarefa.
