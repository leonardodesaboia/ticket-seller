# Handoff — Auditoria, publicação e catálogo público

## Data e estado geral

Checkpoint salvo em 2026-07-29.

```text
TASK-020A  COMPLETED e revisada
TASK-021   COMPLETED e revisada
TASK-022   IN_PROGRESS — fundação pronta, operação de publicação pendente
TASK-023   BLOCKED por TASK-022
TASK-024   BLOCKED por TASK-021 + TASK-022 + TASK-023
```

Nenhum agente continua executando implementação após este checkpoint.

## Escopo autorizado

- corrigir os achados técnicos das TASK-018 a TASK-020;
- implementar readiness, publicação, catálogo público e interfaces;
- preservar multi-tenancy, optimistic concurrency, idempotência, auditoria e
  transactional outbox;
- nunca expor `onlineInfo`;
- nunca retornar eventos `DRAFT` no catálogo público;
- recalcular readiness no backend durante a publicação.

Continuam fora do escopo: reservas, pedidos, checkout, pagamentos, emissão de
ingressos, QR Code e check-in.

## TASK-020A — concluída

### Implementado

- `IVenueAccessPort` movido de `domain/ports` para `application/ports`;
- imports, adapter de venues e composição dos módulos atualizados;
- validação arquitetural corrigida para inspecionar caminhos `domain`;
- resposta administrativa de evento passou a retornar somente
  `onlineConfigured`;
- `onlineInfo` omitido preserva o valor;
- `clearOnlineInfo: true` é a única remoção explícita;
- `null`, vazio, whitespace, excesso de tamanho e replace+clear são rejeitados;
- mudança de formato não apaga informação privada;
- backoffice informa se existe configuração privada sem preencher o segredo;
- chave de criação de ticket type permanece estável durante a mesma operação;
- payload alterado após falha inicia nova operação;
- sucesso ou reset encerra a operação e libera nova chave;
- backend normaliza e limita `Idempotency-Key` a 1–255 caracteres imprimíveis;
- hash inclui organização, evento e todos os campos materiais;
- idempotency record, ticket type, outbox e cache da resposta são atômicos;
- replay confirmado funciona mesmo depois de o evento sair de `DRAFT`;
- payload diferente com a mesma chave retorna `409`;
- criação/edição de ticket type e alteração de moeda usam o mesmo
  `Event FOR UPDATE`;
- o currency lock é revalidado dentro da transação;
- caminho de criação de ticket type sem lock foi removido.

### Segurança confirmada

- autorização e tenant são verificados antes de replay;
- `onlineInfo` não aparece em response, outbox, auditoria ou logs atuais;
- não existe mais TOCTOU entre moeda e criação do primeiro ticket type;
- nenhuma migration aplicada foi alterada.

### Validações registradas

| Validação | Resultado |
| --- | --- |
| API unitária | 80/80 |
| Integração PostgreSQL dos módulos afetados | 89/89 |
| Backoffice unitária | 23/23 |
| API/backoffice lint e typecheck | aprovados |
| Validação arquitetural | aprovada |
| Revisão técnica independente | APPROVED |
| Revisão de segurança independente | APPROVED |

Relatório detalhado:
`.ai/reports/TASK-020A-task-018-020-audit-corrections.md`.

## TASK-021 — concluída

### Implementado

- `PublicationReadinessPolicy` pura e reutilizável;
- `now` recebido explicitamente;
- 20 códigos estáveis na ordem congelada;
- ordem determinística por regra e por ID nos erros de ticket type;
- critérios para organização, DRAFT, título, formato, agenda, timezone, venue,
  configuração online, BRL e ticket types ativos;
- descrição permanece opcional;
- período de vendas não foi inventado porque o modelo atual não possui campos;
- formatos `IN_PERSON`, `ONLINE` e `HYBRID`;
- port de consulta e adapter Prisma tenant-scoped;
- endpoint administrativo:
  `GET /api/v1/organizations/:organizationId/events/:eventId/publication-readiness`;
- somente OWNER, ADMIN e EVENT_MANAGER;
- outsider e cross-tenant recebem `404`; papel insuficiente recebe `403`;
- snapshot contém `onlineConfigured`, nunca o conteúdo de `onlineInfo`;
- DTO administrativo explícito.

### Validações registradas

| Validação | Resultado |
| --- | --- |
| Unitários da policy/use case | 32/32 |
| Integração PostgreSQL do endpoint | 9/9 |
| API lint e typecheck | aprovados |
| Validação arquitetural | aprovada |
| Revisão técnica independente | APPROVED |
| Revisão de segurança independente | APPROVED |

Relatório detalhado: `.ai/reports/TASK-021-publication-readiness.md`.

### Condição obrigatória para TASK-022

O adapter de consulta da readiness usa o Prisma global. A publicação não pode
chamá-lo esperando atomicidade. Ela deve:

```text
abrir transação
→ reservar/verificar idempotência
→ bloquear Event tenant-scoped com FOR UPDATE
→ montar o snapshot com o transaction client
→ chamar a mesma PublicationReadinessPolicy
→ publicar/outbox/auditoria/cache
→ commit
```

## TASK-022 — estado parcial

### Fundação de banco concluída pelo único Database Owner

- `Event.publishedAt` adicionado ao Prisma como `TIMESTAMPTZ NULL`;
- migration nova
  `20260729000005_event_publication/migration.sql`;
- constraint de estados documentados:
  `DRAFT`, `PUBLISHED`, `PAUSED`, `CANCELLED`, `COMPLETED`;
- constraint exige slug não vazio e `published_at` para `PUBLISHED`;
- unicidade global existente de slug preservada;
- índice parcial:
  `(starts_at ASC, id ASC) WHERE status = 'PUBLISHED'`;
- Prisma Client gerado;
- migrations aplicadas com sucesso em PostgreSQL limpo.

### TDD e validação do banco

- RED confirmado: evento podia ser colocado em `PUBLISHED` sem slug/timestamp;
- GREEN confirmado após a migration;
- teste rejeita publicação sem campos obrigatórios;
- teste aceita publicação completa;
- teste rejeita status desconhecido;
- teste confirma a existência do índice público;
- teste PostgreSQL limpo: 6/6 aprovado;
- `prisma generate`, typecheck e `validate-migrations.sh` aprovados.

### RFC 9457 parcial concluído

O filtro HTTP agora:

- responde como `application/problem+json`;
- preserva somente extensões seguras `code`, `version` e `issues`;
- valida estruturalmente cada issue;
- não espalha propriedades arbitrárias da exceção;
- possui teste unitário RED/GREEN aprovado;
- passou em lint e typecheck da API.

### Ainda não implementado na TASK-022

- entidade/mappers administrativos com slug e `publishedAt`;
- request DTO `{ version }`;
- validação da `Idempotency-Key` para publicação;
- use case de publicação;
- operation port/adapter transacional;
- slugificação e truncamento seguro;
- lock do evento dentro da operação;
- montagem transaction-scoped do snapshot;
- recálculo da readiness sob lock;
- transição `DRAFT → PUBLISHED`;
- incremento de versão;
- idempotência e replay após resposta perdida;
- `event.published.v1`;
- `audit_entries` com `event.published`;
- controller `POST .../:eventId/publish`;
- erros estruturados `409` e `422`;
- testes de sucesso, falhas, rollback e concorrência;
- revisão técnica e de segurança da operação completa;
- relatório final da TASK-022.

### Achados médios conhecidos da revisão da migration

1. A migration pressupõe que não existam linhas legadas `PUBLISHED` sem
   slug/timestamp. Isso corresponde ao estado funcional oficial, pois não havia
   publicação, mas deve ser validado antes de aplicar em um banco persistente.
   Não fazer downgrade silencioso para `DRAFT`.
2. O teste atual confirma o índice pelo nome, mas ainda deve validar também
   `indexdef`, colunas, ordem e predicado parcial.

Não há achado bloqueante ou alto na fundação de banco.

## TASK-023 — não iniciada

Contratos permanecem congelados:

```text
GET /api/v1/public/events?cursor=<opaque>&limit=20
GET /api/v1/public/events/:slug
```

Falta implementar:

- query/port/adapter público;
- controller sem `ActorGuard` e sem `X-Dev-User-Id`;
- listagem apenas `PUBLISHED` em andamento/futuros;
- detalhe publicado, inclusive após o término;
- keyset por `startsAt ASC, id ASC`;
- cursor opaco e limite máximo 100;
- DTO público independente;
- venue público apenas com nome, cidade, estado e país;
- ticket types apenas ativos, sem IDs/capacidade/versão;
- `onlineInfo` não selecionado nem apresentado;
- `404` indistinguível para slug ausente e evento não publicado;
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`;
- testes de contrato, paginação, ordenação e segurança;
- revisão e relatório.

Antes do frontend, congelar o shape JSON exato da listagem e do detalhe,
incluindo a decisão sobre `priceFrom`.

## TASK-024 — não iniciada

Só pode começar quando TASK-021, TASK-022 e TASK-023 estiverem integradas e os
contratos finais estiverem congelados.

### Backoffice pendente

- features `publication-readiness` e `publish-event`;
- checklist na página de detalhe;
- mapeamento de códigos para texto/seção/link;
- fallback para código desconhecido;
- confirmação acessível;
- idempotência estável por operação;
- prevenção de duplo clique;
- tratamento de rede, `409`, `422` e sucesso;
- invalidação de cache;
- bloqueio das edições após publicação.

### Marketplace pendente

- listagem mínima na página inicial;
- detalhe em `/events/[slug]`;
- formatos, datas, timezone, venue e tipos ativos;
- preço formatado em BRL;
- mensagem clara de compra ainda indisponível;
- metadata básica e canonical;
- loading, vazio, erro e `404`;
- nenhum botão funcional de compra;
- nenhum `onlineInfo`, capacidade, versão ou controle administrativo.

### Qualidade pendente

- testes de componentes, hooks e metadata;
- acessibilidade;
- detector final do workflow visual;
- E2E do fluxo completo quando viável;
- builds dos dois frontends.

## Ordem exata para retomada

1. Ler este handoff e `.ai/tasks/TASK-022-event-publication.md`.
2. Confirmar que somente o Database Owner já definido tocou Prisma/migrations.
3. Endurecer o teste da definição do índice.
4. Decidir/prevalidar banco persistente quanto a eventos legados `PUBLISHED`.
5. Implementar a operação transacional da TASK-022 com TDD.
6. Executar revisão técnica e de segurança; corrigir BLOQUEANTE/ALTO.
7. Validar e integrar TASK-022; criar relatório.
8. Implementar, revisar e integrar TASK-023.
9. Congelar os DTOs JSON finais de readiness/publicação/catálogo.
10. Só então paralelizar os dois frontends da TASK-024 por caminhos exclusivos.
11. Atualizar documentação global.
12. Executar validação global completa.

## Validações globais ainda pendentes

Não declarar estas validações como aprovadas até serem realmente executadas no
estado final:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ticket-seller/api test:integration
pnpm build

.ai/scripts/validate-changed-files.sh
.ai/scripts/validate-architecture.sh
.ai/scripts/validate-migrations.sh
.ai/scripts/test-affected.sh
.ai/scripts/scan-secrets.sh
```

O workspace raiz não possui atualmente scripts `test:integration` ou
`test:e2e`; usar os comandos dos pacotes aplicáveis e registrar essa diferença.

## Documentação ainda pendente ao final da fase

- relatório final da TASK-022;
- relatórios da TASK-023 e TASK-024;
- `docs/CURRENT_STATE.md`;
- `docs/REPOSITORY_MAP.md`;
- `docs/ARCHITECTURE.md`, se necessário;
- `docs/modules/events.md`;
- `docs/modules/venues.md`, apenas se o contrato público exigir;
- documentação de contratos/OpenAPI;
- `docs/modules/inventory.md` somente se houver mudança real — até agora não há.

## Estado do worktree e cuidados

As mudanças desta execução ainda não foram commitadas. Não descartar o
worktree.

Mudanças preexistentes do usuário que não pertencem a esta execução e devem ser
preservadas:

- exclusão de `ai/reports/TASK-003-tooling-standards.md`;
- exclusão de `ai/tasks/TASK-003-tooling-standards.md`;
- modificação de `apps/backoffice-web/tsconfig.tsbuildinfo`.

Os scripts `.ai/scripts/*.sh` receberam somente modo executável para poderem ser
invocados conforme a documentação oficial.

Não executar `git reset --hard`, `git checkout --` ou limpeza ampla. Antes de
qualquer commit, selecionar explicitamente apenas os arquivos desta execução.

## Riscos e recomendações não bloqueantes

- retry explícito limitado para Prisma/PostgreSQL `P2034` pode melhorar
  disponibilidade de transações Serializable;
- redaction preventiva de `onlineInfo` no Pino protege contra futura ampliação
  dos serializers, embora o body não seja logado hoje;
- readiness administrativa pode receber `Cache-Control: private, no-store`;
- adicionar um teste com sentinela real em `onlineInfo` na readiness;
- rate limiting público permanece pendência futura, sem introduzir Redis nesta
  fase.
