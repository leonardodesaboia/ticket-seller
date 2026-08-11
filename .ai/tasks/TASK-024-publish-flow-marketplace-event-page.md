# TASK-024 — Publish Flow and Marketplace Event Page

## Status

CONCLUÍDA (task/024-publish-flow-marketplace; 42/42 testes; revisão independente executada; aguardando integração na develop). Relatório: `.ai/reports/TASK-024-publish-flow-marketplace-event-page.md`.

## Objetivo

Implementar o checklist e a publicação no backoffice, além da listagem mínima e
da página pública no marketplace.

## Dependências

TASK-021, TASK-022 e TASK-023 integradas com contratos FROZEN.

## Propriedade exclusiva

- `apps/backoffice-web/src/features/publication-readiness/`
- `apps/backoffice-web/src/features/publish-event/`
- composição das páginas administrativas de evento
- `apps/marketplace-web/src/features/public-event-catalog/`
- `apps/marketplace-web/src/features/public-event-details/`
- `apps/marketplace-web/src/app/page.tsx`
- `apps/marketplace-web/src/app/events/[slug]/`
- testes diretamente relacionados

## Backoffice

- checklist na página de detalhe;
- consumir códigos do backend sem duplicar regras;
- exibir código desconhecido genericamente;
- links para edição/configuração;
- confirmação inline acessível;
- chave idempotente estável por operação;
- bloquear duplo clique;
- tratar rede, `409`, `422` e sucesso;
- invalidar caches;
- bloquear controles de edição após publicação.

## Marketplace

- listagem mínima na raiz;
- detalhe em `/events/[slug]`;
- título, descrição, formato, datas, timezone, venue e tipos ativos;
- preços em BRL;
- mensagem de compra indisponível;
- metadata básica com canonical;
- sem controles administrativos, `onlineInfo`, capacidade ou compra funcional.

## Acessibilidade

Headings coerentes, checklist semântico, foco após erro, labels, estado de
loading, teclado, contraste por tokens e datas/preços legíveis.

## Testes obrigatórios

Readiness pronta/incompleta, issue desconhecida, navegação, publicação,
idempotência, duplo clique, rede, conflito, `422`, cache e sucesso; marketplace
publicado/404, formatos, venue, preço, metadata, ausência de dados privados e
acessibilidade.

## Fora do escopo

Checkout, reserva, pedido, pagamento, ingresso, QR Code, check-in e deploy.
