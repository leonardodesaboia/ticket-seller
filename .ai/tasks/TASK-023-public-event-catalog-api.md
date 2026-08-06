# TASK-023 — Public Event Catalog API

## Status

IN_REVIEW (implementação concluída, revisada e validada em task/023-public-event-catalog-api; aguardando integração em develop). Relatório: `.ai/reports/TASK-023-public-event-catalog-api.md`.

## Objetivo

Expor listagem e detalhe públicos seguros para eventos publicados.

## Dependências

TASK-022.

## Propriedade exclusiva

- ports/use cases/adapters públicos do módulo events
- controller em namespace público
- DTOs/presenters públicos
- testes públicos de integração

## Contratos congelados

```text
GET /api/v1/public/events?cursor=<opaque>&limit=20
GET /api/v1/public/events/:slug
```

- sem `ActorGuard` e sem `X-Dev-User-Id`;
- keyset `startsAt ASC, id ASC`;
- listagem inclui somente publicados em andamento/futuros (`endsAt >= now`);
- detalhe publicado continua acessível após o término;
- nenhum filtro adicional nesta fase;
- `404` indistinguível para slug inexistente e evento não publicado;
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

## Dados públicos

Evento: slug, título, descrição, formato, início, término, timezone e moeda.

Venue: nome, cidade, estado e país. Não retornar endereço completo ou IDs.

Ticket types: apenas ativos, com nome, descrição, preço e moeda. Não retornar
capacidade, versão ou IDs administrativos.

## Segurança

- `status=PUBLISHED` deve fazer parte da consulta;
- DTO público independente do administrativo;
- `onlineInfo` nunca é selecionado nem apresentado;
- DRAFT nunca aparece em listagem ou detalhe;
- erros públicos não revelam existência administrativa.

## Testes obrigatórios

Publicado/DRAFT, slug, 404, paginação, ordenação, eventos passados, três
formatos, venue público, tipos ativos/inativos, ausência estrutural de dados
privados e endpoint sem autenticação.

## Fora do escopo

Busca avançada, Redis, CDN, estoque em tempo real, compra e rate limiting novo.
