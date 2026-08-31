Relatório da TASK-068 — Migração para pg-boss: scheduler durável para SettlementWorker e ReconciliationWorker

Status

COMPLETED

Arquivos alterados

- `apps/api/package.json`: `pg-boss@10.4.2` adicionado a `dependencies` (não devDependencies).
- `pnpm-lock.yaml`: lockfile regenerado com pg-boss@10.4.2.
- `apps/api/src/app.module.ts`: `PgBossModule` importado.
- `apps/api/src/platform/scheduling/pgboss.module.ts`: criado — provider global do token `PG_BOSS`; factory usa `DATABASE_URL` e schema `pgboss`; listener de erro registrado antes de `boss.start()`; `onModuleDestroy` chama `boss.stop()`.
- `apps/api/src/platform/scheduling/pgboss.module.spec.ts`: criado — 4 testes: `start()` chamado na inicialização, listener de erro registrado, `stop()` chamado no destroy, propagação de falha de `start()`.
- `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts`: `setInterval`/`isRunning` removidos; `onModuleInit` registra `createQueue → schedule → work` com cron `0 * * * *` UTC; `fetchEligibleOrders` envolto em `$transaction` com `FOR UPDATE SKIP LOCKED`; `processed++` incrementa apenas em sucesso; falhas de poll re-lançadas.
- `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.spec.ts`: criado — 9 testes: ordem `createQueue → schedule → work`, cron e job name corretos, propagação de falha em cada etapa, poll sem pedidos elegíveis, processamento em batch, re-throw em falha de fetch, absorção de falhas individuais por item, parada quando batch menor que chunkSize.
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts`: `setInterval`/`isPolling` removidos; `onModuleInit` registra `createQueue → schedule → work` com cron `*/15 * * * *` UTC; lógica de `reconcilePayout`, `handleSucceeded` e `handleFailed` inalterada.
- `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.spec.ts`: criado — 17 testes: ordem de inicialização, cron e job name, propagação de falha em createQueue/schedule, poll sem payouts stuck, re-throw em falha de fetch, absorção de falhas individuais, skip sem `externalPayoutId`, PROCESSING sem mutação, roteamento PAID → handleSucceeded e FAILED → handleFailed, detecção de divergência de valor/moeda com outbox event, omissão de amount sem mismatch, idempotência por status sob lock em handleSucceeded e handleFailed.
- `apps/api/test/e2e/health.e2e-spec.ts`: mock de `PG_BOSS` adicionado com `createQueue`, `schedule`, `work`, `start`, `stop`, `on` — padrão existente de Prisma e object storage.
- `docs/decisions/ADR-011-pgboss-durable-scheduler.md`: criada — justificativa, alternativas (BullMQ, cron nativo), consequências e limitações documentadas.

Implementado

- `PgBossModule` global em `platform/scheduling/` expõe o token `PG_BOSS`; qualquer módulo que injete o token recebe a instância compartilhada sem depender de `FinanceModule`.
- Schedules de `SettlementWorker` e `ReconciliationWorker` persistem em `pgboss.schedule` — sobrevivem a restart do processo, eliminando o restart-drift do `setInterval`.
- Com múltiplas réplicas, pg-boss serializa execução por tick via `FOR UPDATE SKIP LOCKED` interno em `pgboss.job`.
- `SettlementWorker.fetchEligibleOrders` passou a usar `FOR UPDATE SKIP LOCKED` dentro de `$transaction` explícita — pedidos não são processados em duplicata entre réplicas na mesma janela.
- Falhas de poll ficam registradas em `pgboss.job` com estado `failed`, consultáveis por SQL.
- `OutboxNotificationWorker` mantido com `setInterval` (5s incompatível com granularidade mínima de 1 min do pg-boss); já possui `FOR UPDATE SKIP LOCKED`.
- Tipos dos spec files sem `any` ou `unknown` escritos explicitamente: `jest.MockedFunction<PgBoss['createQueue']>`, `jest.MockedFunction<PgBoss['schedule']>`, `jest.Mock<Promise<string>, [string, () => Promise<void>]>` para `work`, `jest.Mocked<Pick<IPorte, 'método'>>` para todos os ports, `(cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>)` nas chamadas de `mockImplementation`.

Decisões tomadas

- `boss.work` tipado como `jest.Mock<Promise<string>, [string, () => Promise<void>]>` em vez de `jest.Mocked<Pick<PgBoss, 'work'>>` porque TypeScript resolve a última sobrecarga (3 parâmetros com `WorkOptions`), tornando inválidas as chamadas de `mockImplementation` com 2 parâmetros — a sobrecarga de 2 parâmetros não é atingível via `Parameters<>`.
- `$transaction` do Prisma mantido como `jest.Mock` (sem parâmetros de tipo) nos specs: duas sobrecargas (array e callback) com `Prisma.TransactionClient` genérico tornam inviável expressar o tipo sem `unknown`; o ganho de especificidade não justifica a complexidade.
- `createQueue → schedule → work` (em vez de `schedule → work`) para garantir que a fila exista antes de registrar o schedule — necessário quando o schema `pgboss` é criado do zero.
- Listener de erro registrado antes de `boss.start()` para capturar eventos emitidos durante a inicialização, antes de `onModuleInit` ser chamado.
- Nenhum ADR novo além da ADR-011; ADR-010 (colocalização de workers) permanece como contexto arquitetural.

Testes executados

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | aprovado (0 erros) |
| `npx jest --runInBand` | aprovado (566/566 testes, 84 suites) |
| `bash .ai/scripts/validate-architecture.sh` | aprovado (APROVADA) |
| `grep "as any\|: any\|as unknown\|: unknown"` nos 3 spec files | aprovado (0 ocorrências) |
| `pnpm --filter @ticket-seller/api build` | aprovado |

Riscos identificados

- pg-boss cria o schema `pgboss` automaticamente na primeira inicialização — em produção com usuário de banco com permissões restritas, verificar `CREATE SCHEMA`.
- `boss.start()` abre conexão PostgreSQL adicional separada do pool do Prisma — aceitável para MVP; monitorar em carga.

Pendências

- Integração PostgreSQL real (Testcontainers) para validar que schedules aparecem em `pgboss.schedule` após `onModuleInit`. CI não possui PostgreSQL; testes unitários com mock cobrem o comportamento; validação de integração permanece pendente.

Documentação atualizada

- `.ai/tasks/TASK-068-pgboss-durable-scheduler.md`
- `.ai/reports/TASK-068-pgboss-durable-scheduler.md`
- `docs/decisions/ADR-011-pgboss-durable-scheduler.md`
- `docs/CURRENT_STATE.md`

Próxima tarefa recomendada

TASK-069 — Idempotência e isolamento de tenant em payouts (idempotency_key escopado por organization_id, testes de integração PostgreSQL reais).
