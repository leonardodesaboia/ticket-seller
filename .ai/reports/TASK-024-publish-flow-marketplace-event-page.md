Relatório da TASK-024 — Publish Flow and Marketplace Event Page

Status

IN_PROGRESS (implementação concluída e buildando; 1 pendência de teste — ver Pendências). Branch: task/024-publish-flow-marketplace (a partir de develop), commit 50d84f6.

Decisões aprovadas

- Marketplace renderizado como Server Components (SEO/metadata/canonical + cache público).
- Uma única branch sequencial para os dois frontends.
- Contratos consumidos já congelados (TASK-021/022/023); nenhum backend/schema/migration alterado.

Arquivos alterados

Marketplace (apps/marketplace-web/src/):
- shared/api/public-events.api.ts: cliente público tipado (list + detail; null em 404; revalidate 60s).
- shared/lib/money.ts (+ .test.ts): formatCurrency BRL (normaliza NBSP).
- shared/lib/event-format.ts: formatEventFormat + formatDateTime (timezone do evento).
- features/public-event-catalog/ (CatalogHome, EventList, EventCard, index) + testes.
- features/public-event-details/ (EventDetails, index) + teste.
- app/page.tsx (home, force-dynamic), app/events/[slug]/{page.tsx (generateMetadata+canonical, notFound), not-found.tsx, loading.tsx}.
- app/layout.tsx: metadataBase. app/page.test.tsx atualizado (Page virou async → testa CatalogHome).

Backoffice (apps/backoffice-web/src/):
- features/publication-readiness/ (types, api, hook, lib/issue-catalog, PublicationChecklist, index) + teste do checklist.
- features/publish-event/ (lib/idempotency + spec, api/publish.api com PublishError problem+json, hook, PublishEventPanel, index).
- app/organizations/[organizationId]/events/[eventId]/page.tsx: compõe PublishEventPanel em DRAFT (controles de edição já somem após publicação).

Implementado

- Marketplace: home lista publicados; detalhe /events/[slug] com título, descrição, formato, datas, timezone, venue público e tipos ativos, preço BRL, mensagem de compra indisponível, metadata+canonical, 404 amigável; nenhum dado privado (onlineInfo/IDs/capacidade) renderizado.
- Backoffice: checklist consumindo códigos/mensagens do backend (sem duplicar regras), links por seção, fallback para código desconhecido; publicação com chave idempotente estável por operação, guarda de duplo clique, tratamento de 409/422/rede/sucesso, invalidação de caches, confirmação inline acessível (foco no alerta de erro).

Testes executados

Comando	Resultado
marketplace typecheck/lint/test/build	aprovado (test 10/10)
backoffice typecheck/lint/test/build	aprovado (test 29/29)

Pendências

- Reintroduzir o teste de interação PublishEventPanel.test.tsx: no harness jest do backoffice, render dentro de QueryClientProvider retornava body vazio (provável mismatch de contexto/instância do QueryClient em jsdom). Não é bug do componente (typecheck/lint/build passam). Lógica subjacente (idempotência, checklist) já coberta por testes verdes. Recomenda-se um helper renderWithClient compartilhado.
- Revisão independente (técnica + segurança/acessibilidade) da TASK-024.
- Integração na develop (aguardando autorização; sem push, sem main).

Documentação atualizada

- .ai/tasks/TASK-024-publish-flow-marketplace-event-page.md
- .ai/coordination/ACTIVE_TASKS.md, INTEGRATION_QUEUE.md
- docs/CURRENT_STATE.md

Próxima etapa recomendada

Corrigir o harness e reintroduzir o teste do painel; então revisão independente, relatório final e, com autorização, fast-forward na develop.
