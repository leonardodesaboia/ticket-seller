# TASK-021 — Publication Readiness

## Status

COMPLETED

## Objetivo

Criar uma avaliação única, determinística e reutilizável que informe se um
evento pode ser publicado.

## Dependências

TASK-020A.

## Propriedade exclusiva

- `apps/api/src/modules/events/domain/publication/`
- `apps/api/src/modules/events/application/ports/publication-readiness-query.port.ts`
- `apps/api/src/modules/events/application/use-cases/get-publication-readiness.use-case.ts`
- adapter Prisma de readiness
- controller e response administrativos de readiness
- testes unitários e de integração relacionados

## Contrato congelado

```text
GET /api/v1/organizations/:organizationId/events/:eventId/publication-readiness
```

```json
{
  "ready": false,
  "version": 4,
  "issues": [
    {
      "code": "EVENT_STARTS_AT_REQUIRED",
      "field": "startsAt",
      "section": "schedule",
      "message": "Defina a data e o horário de início."
    }
  ]
}
```

## Códigos estáveis

- `ORGANIZATION_NOT_ACTIVE`
- `EVENT_NOT_DRAFT`
- `EVENT_TITLE_REQUIRED`
- `EVENT_FORMAT_REQUIRED`
- `EVENT_FORMAT_INVALID`
- `EVENT_STARTS_AT_REQUIRED`
- `EVENT_ENDS_AT_REQUIRED`
- `EVENT_TIMEZONE_REQUIRED`
- `EVENT_TIMEZONE_INVALID`
- `EVENT_DATE_RANGE_INVALID`
- `EVENT_ALREADY_ENDED`
- `EVENT_VENUE_REQUIRED`
- `EVENT_VENUE_INVALID`
- `EVENT_ONLINE_CONFIGURATION_REQUIRED`
- `EVENT_CURRENCY_REQUIRED`
- `EVENT_CURRENCY_UNSUPPORTED`
- `TICKET_TYPE_ACTIVE_REQUIRED`
- `TICKET_TYPE_NAME_INVALID`
- `TICKET_TYPE_PRICE_INVALID`
- `TICKET_TYPE_CAPACITY_INVALID`

## Regras

- organização deve estar ativa;
- evento deve estar em `DRAFT`;
- título não vazio após trim; descrição continua opcional;
- formato, início, término, timezone IANA e moeda `BRL` são obrigatórios;
- término deve ser posterior ao início e ao instante da avaliação;
- `IN_PERSON` exige venue válido da organização;
- `HYBRID` exige venue válido e configuração online;
- `ONLINE` exige configuração online;
- ao menos um ticket type ativo e válido;
- ausência de período de vendas é válida nesta fase, pois o modelo ainda não o
  oferece;
- issues usam ordem estável definida pela policy.

## Autorização e multi-tenancy

OWNER, ADMIN e EVENT_MANAGER podem consultar. Papel insuficiente recebe `403`;
não membro, evento inexistente ou acesso cruzado recebem `404`.

## Arquitetura

Uma policy pura recebe dados já resolvidos e o instante atual. O endpoint e a
publicação devem utilizar exatamente essa policy.

## Testes obrigatórios

Caso pronto, cada issue isolada, múltiplas issues, três formatos, cross-tenant,
papel insuficiente, UUID inválido, inexistente, já publicado, timezone e datas,
ticket types inválidos e ordenação determinística.

## Fora do escopo

Publicar, criar slug, alterar estado ou implementar período de vendas.
