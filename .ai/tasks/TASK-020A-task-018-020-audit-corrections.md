# TASK-020A — Correções da auditoria TASK-018 a TASK-020

## Status

COMPLETED

## Objetivo

Corrigir a localização do `IVenueAccessPort`, formalizar o contrato privado de
`onlineInfo` e garantir idempotência real na criação de tipos de ingresso, sem
alterar regras comerciais.

## Dependências

TASK-018, TASK-019 e TASK-020 (MERGED).

## Contexto obrigatório

- `AGENTS.md`
- `.ai/coordination/SIMPLE_USAGE.md`
- `.ai/tasks/TASK-018-event-schedule-venue-foundation.md`
- `.ai/tasks/TASK-019-ticket-types-foundation.md`
- `.ai/tasks/TASK-020-event-configuration-backoffice.md`
- `docs/modules/events.md`
- `docs/modules/venues.md`

## Propriedade exclusiva

- `apps/api/src/modules/events/application/ports/`
- arquivos de configuração e ticket types diretamente afetados em
  `apps/api/src/modules/events/`
- `apps/api/src/modules/venues/infrastructure/adapters/prisma-venue-access.adapter.ts`
- `apps/api/src/modules/venues/venues.module.ts`
- testes relacionados em `apps/api/test/integration/`
- `apps/backoffice-web/src/features/events/`
- `apps/backoffice-web/src/features/ticket-types/`
- `.ai/scripts/validate-architecture.sh`

## Contratos congelados

### Resposta administrativa de evento

Adicionar `onlineConfigured: boolean`. Nunca retornar `onlineInfo`.

### PATCH de configuração

- campo omitido: preservar;
- `onlineInfo` não vazia: criar ou substituir;
- `clearOnlineInfo: true`: limpar;
- `onlineInfo: null`, string vazia ou ambos os comandos: `400`;
- mudar o formato não limpa automaticamente a configuração privada.

### Idempotência de ticket type

- escopo: organização + evento + chave;
- todos os campos materiais participam do hash;
- mesma chave e mesmo payload: resposta anterior;
- mesma chave e payload diferente: `409`;
- record, ticket type e outbox devem ser atômicos.

## Invariantes e segurança

- `onlineInfo` não aparece em response, outbox, auditoria ou logs;
- acesso cross-tenant continua retornando comportamento não enumerável;
- retry após resposta perdida não duplica ticket type;
- domínio não depende do port cross-module de venue;
- nenhuma migration aplicada é alterada.

## TDD e testes

- escrever primeiro testes de preservação/remoção explícita de `onlineInfo`;
- testar `onlineConfigured` sem conteúdo privado;
- testar ciclo da chave no frontend;
- testar payload diferente, replay e concorrência no backend;
- executar unitários, integração, lint, typecheck e validação arquitetural.

## Fora do escopo

Publicação, catálogo público, checkout e distribuição de credenciais online.
