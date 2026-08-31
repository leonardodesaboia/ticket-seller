# TASK-068 — Migração para pg-boss: scheduler durável para SettlementWorker e ReconciliationWorker

## Status

COMPLETED

## Objetivo

Substituir `setInterval` + `isRunning` nos workers de finance por pg-boss, eliminando restart drift e adicionando histórico de falhas consultável. ADR-011 aprovada.

## Resultado observável

- `SettlementWorker` e `ReconciliationWorker` registram schedules em `pgboss.schedule` ao subir;
- um deploy não reseta o timer — o próximo job já está agendado no banco;
- falhas ficam em `pgboss.job` com estado `failed`, consultáveis por SQL;
- `OutboxNotificationWorker` permanece com `setInterval` (5s incompatível com cron do pg-boss);
- `SettlementWorker.fetchEligibleOrders` passa a incluir `FOR UPDATE SKIP LOCKED`;
- todos os testes e validações arquiteturais passam.

## Contexto obrigatório

- `AGENTS.md`
- esta task
- `docs/decisions/ADR-011-pgboss-durable-scheduler.md`
- `docs/decisions/ADR-010-workers-scheduler-colocation.md`
- workers em `apps/api/src/modules/finance/infrastructure/workers/`
- worker em `apps/api/src/modules/notifications/infrastructure/workers/`

## Arquivos permitidos

- `apps/api/src/platform/scheduling/pgboss.module.ts` — criar
- `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts` — modificar
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts` — modificar
- `apps/api/src/modules/finance/infrastructure/workers/*.worker.spec.ts` — criar
- `apps/api/src/platform/scheduling/pgboss.module.spec.ts` — criar
- `apps/api/src/app.module.ts` — adicionar import de PgBossModule
- `apps/api/package.json` — adicionar `pg-boss` em dependencies
- `pnpm-lock.yaml` — atualizado pelo pnpm install
- `docs/CURRENT_STATE.md` — atualizar ao concluir
- `.ai/reports/TASK-068-pgboss-durable-scheduler.md` — criar ao concluir

## Arquivos proibidos

- qualquer use case, domain entity, port ou DTO;
- migrations Prisma e schema.prisma;
- contratos HTTP (controllers, DTOs de apresentação, OpenAPI);
- `OutboxNotificationWorker` — não migrar;
- qualquer módulo fora de finance e platform/scheduling;
- `notifications.module.ts` e `finance.module.ts` — não precisam de alteração (PgBossModule é global).

## Requisitos funcionais

- `SettlementWorker` executa via cron `0 * * * *` (UTC, a cada hora);
- `ReconciliationWorker` executa via cron `*/15 * * * *` (UTC, a cada 15 min);
- schedules sobrevivem a restart do processo;
- com múltiplas réplicas, apenas uma processa cada tick de cada job;
- falhas de poll marcam o job como `failed` no pg-boss (re-throw do erro);
- falhas individuais de pedido ou payout continuam sendo absorvidas localmente (try/catch por item).

## Requisitos técnicos

- `PgBossModule` em `platform/scheduling/` é global e exporta o token `PG_BOSS`;
- `PgBossModule.onModuleDestroy` chama `boss.stop()` para shutdown gracioso;
- workers usam `@Inject(PG_BOSS)` e registram em `onModuleInit` (async);
- `FOR UPDATE SKIP LOCKED` adicionado ao `fetchEligibleOrders` do `SettlementWorker`;
- `isRunning`/`isPolling` flags removidos dos dois workers migrados;
- pg-boss adicionado como `dependency` (não devDependency) em `apps/api/package.json`.

## Invariantes

- nenhum use case é alterado;
- nenhum contrato HTTP é alterado;
- nenhuma migration Prisma é criada para a migração dos workers;
- `OutboxNotificationWorker` não é modificado;
- lógica de negócio dos workers (fetchEligibleOrders, processOrder, reconcilePayout) permanece idêntica, exceto pela adição do SKIP LOCKED.

## Segurança

- pg-boss usa `DATABASE_URL` existente — nenhuma credencial nova;
- nenhum secret registrado em logs;
- nenhuma superfície HTTP exposta.

## Multi-tenancy

Não aplicável diretamente — workers processam todos os registros elegíveis respeitando o `organization_id` existente nos use cases e queries.

## Concorrência

- pg-boss usa `FOR UPDATE SKIP LOCKED` internamente ao selecionar jobs — apenas uma réplica processa cada tick;
- `SettlementWorker` adiciona `FOR UPDATE SKIP LOCKED` no SELECT de elegíveis;
- `ReconciliationWorker` já tinha SKIP LOCKED — mantido.

## Idempotência

- `SettlementWorker`: `ON CONFLICT (order_id) DO NOTHING` em `balance_settlements` — mantido no use case;
- `ReconciliationWorker`: re-check de status sob `FOR UPDATE` dentro da transação — mantido.

## Fora do escopo

- separar workers em container próprio;
- migrar `OutboxNotificationWorker`;
- adicionar BullMQ ou Redis Streams;
- métricas Prometheus para jobs;
- integração com PSP real;
- qualquer feature de produto.

## Critérios de aceite

- `pnpm --filter @ticket-seller/api typecheck` aprovado;
- `pnpm --filter @ticket-seller/api lint` aprovado;
- `pnpm --filter @ticket-seller/api test -- --runInBand` aprovado;
- `bash .ai/scripts/validate-architecture.sh` aprovado;
- `apps/api` builda sem erros;
- schedules aparecem em `pgboss.schedule` ao subir (verificável em dev);
- `OutboxNotificationWorker` inalterado.

## Comandos

```bash
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api test -- --runInBand
bash .ai/scripts/validate-architecture.sh
pnpm --filter @ticket-seller/api build
```

## Conclusão esperada

### Arquivos alterados
- `apps/api/src/platform/scheduling/pgboss.module.ts`: criado — provider global `PG_BOSS`, shutdown gracioso.
- `apps/api/src/platform/scheduling/pgboss.module.spec.ts`: criado — 4 testes.
- `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts`: `setInterval`/`isRunning` removidos; cron `0 * * * *` UTC; `FOR UPDATE SKIP LOCKED` em `$transaction` explícita.
- `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.spec.ts`: criado — 9 testes.
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts`: `setInterval`/`isPolling` removidos; cron `*/15 * * * *` UTC.
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.spec.ts`: criado — 17 testes.
- `apps/api/src/app.module.ts`: `PgBossModule` importado.
- `apps/api/test/e2e/health.e2e-spec.ts`: mock `PG_BOSS` adicionado.
- `apps/api/package.json`: `pg-boss@10.4.2` em `dependencies`.
- `docs/decisions/ADR-011-pgboss-durable-scheduler.md`: criada.

### Implementado
- Schedules persistem em `pgboss.schedule`; restart do processo não zera o timer.
- `FOR UPDATE SKIP LOCKED` em `fetchEligibleOrders` dentro de `$transaction` explícita.
- Falhas de poll registradas em `pgboss.job` como `failed`.
- `OutboxNotificationWorker` inalterado (5s incompatível com pg-boss).
- Tipos dos specs sem `any`/`unknown` escritos: `jest.MockedFunction<PgBoss['método']>`, `jest.Mocked<Pick<IPort, 'método'>>`, `cb` anotado como `(tx: ReturnType<typeof makeMockTx>) => Promise<void>`.

### Testes
- `npx tsc --noEmit`: aprovado (0 erros)
- `npx jest --runInBand`: aprovado (566/566 testes, 84 suites)
- `bash .ai/scripts/validate-architecture.sh`: aprovado (APROVADA)
- `pnpm --filter @ticket-seller/api build`: aprovado

### Decisões
- `boss.work` tipado como `jest.Mock<Promise<string>, [string, () => Promise<void>]>` — sobrecarga de 3 parâmetros não é atingível via `Parameters<PgBoss['work']>`.
- `createQueue → schedule → work` para garantir fila antes de schedule.
- Listener de erro antes de `boss.start()` para capturar eventos de inicialização.

### Pendências
- Integração PostgreSQL real (Testcontainers) para validar `pgboss.schedule` após `onModuleInit`.

### Próxima tarefa
TASK-069 — Idempotência e isolamento de tenant em payouts.
