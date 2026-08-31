# ADR-011 — pg-boss como scheduler durável para workers de longa duração

## Status

ACCEPTED

## Data

2026-08-28

## Contexto

A API possui dois workers de polling de longa duração registrados no mesmo processo HTTP:

| Worker | Módulo | Intervalo | Problema |
|---|---|---|---|
| `SettlementWorker` | finance | 1 hora | `setInterval` zera a cada restart; sem `FOR UPDATE SKIP LOCKED` no SELECT |
| `ReconciliationWorker` | finance | 15 minutos | `setInterval` zera a cada restart; `isRunning` não protege contra múltiplas réplicas |

Um terceiro worker (`OutboxNotificationWorker`, 5 segundos) não é migrado — o intervalo é sub-minuto, incompatível com o modelo de cron do pg-boss, e o timer de 5 segundos que zera no restart não representa risco operacional relevante.

O problema principal é o **restart drift**: em ambientes com deploys frequentes, o `SettlementWorker` pode não executar dentro da janela esperada de 1 hora porque o timer reinicia do zero a cada deploy. O `ReconciliationWorker` tem o mesmo problema em menor escala. Adicionalmente, falhas individuais de pedidos ou payouts só são rastreáveis via logs — não há histórico consultável.

## Decisão

Adotar **pg-boss** como scheduler durável para `SettlementWorker` e `ReconciliationWorker`.

pg-boss persiste os schedules em tabelas PostgreSQL (`pgboss.schedule`, `pgboss.job`). Um deploy não reseta o relógio — a próxima execução já está agendada no banco. Jobs falhos ficam em `pgboss.job` com estado `failed` e mensagem de erro, consultáveis por SQL.

O `OutboxNotificationWorker` permanece com `setInterval` por incompatibilidade de granularidade (5s < 1min mínimo do pg-boss).

**Escopo técnico:**
- Um `PgBossModule` global é criado em `platform/scheduling/` e importado pelo `AppModule`.
- `SettlementWorker` e `ReconciliationWorker` injetam `PgBoss` e registram schedules em `onModuleInit`.
- O `PgBossModule` chama `boss.stop()` em `onModuleDestroy` para shutdown gracioso.
- O `isRunning` flag é removido dos dois workers — pg-boss garante exatamente-uma-execução por job por tick via `FOR UPDATE SKIP LOCKED` interno.
- O `FOR UPDATE SKIP LOCKED` ausente no `fetchEligibleOrders` do `SettlementWorker` é adicionado como parte desta tarefa.

## Razões

- PostgreSQL já está na infra — nenhuma nova dependência de infraestrutura;
- pg-boss cria e gerencia seu próprio schema (`pgboss`) sem interação com Prisma;
- schedules sobrevivem a restarts — deploy frequente não atrasa settlement;
- histórico de falhas consultável por SQL (`SELECT * FROM pgboss.job WHERE state = 'failed'`);
- reprocessamento manual via SQL (`DELETE FROM pgboss.job WHERE id = ?` para reenviar);
- library leve (~300 KB), sem servidor extra, sem configuração de persistência;
- rollback trivial: reverter para `setInterval` não afeta nenhum use case.

## Consequências positivas

- Settlement e reconciliation não sofrem restart drift em deploys frequentes;
- falhas de jobs individuais ficam registradas com timestamp, tentativas e mensagem de erro;
- com múltiplas réplicas, pg-boss usa `FOR UPDATE SKIP LOCKED` internamente para distribuir jobs — apenas uma réplica processa cada tick;
- scheduled jobs são singleton por default no pg-boss — sem risco de duplicação entre réplicas.

## Consequências negativas

- pg-boss abre uma conexão PostgreSQL própria (separada do pool do Prisma) — aceitável com volume do MVP;
- adiciona ~5 tabelas no schema `pgboss` ao banco — aditivo, sem impacto em dados existentes;
- nova dependência de biblioteca (`pg-boss`) — aprovada por ser justificada e de baixo risco de abandono.

## Alternativas consideradas

### Manter setInterval + adicionar FOR UPDATE SKIP LOCKED

Corrige o bug de concorrência mas não resolve o restart drift. O histórico de falhas continua invisível. Descartado: custo similar, benefício menor.

### BullMQ com Redis

Redis já está na infra, mas BullMQ adicionaria responsabilidade nova ao Redis (filas de jobs). Sem configuração de persistência RDB/AOF, jobs são perdidos em crash de Redis. pg-boss usa PostgreSQL existente com durabilidade garantida. Descartado.

### Container separado para workers

Não resolve o problema de scheduling durável por si só — ainda precisaria de pg-boss ou BullMQ por baixo. Adiciona complexidade de deploy sem benefício proporcional ao MVP. Descartado para MVP.

### pg-boss para OutboxNotificationWorker também

Incompatível: pg-boss cron tem granularidade mínima de 1 minuto. O outbox precisa de 5 segundos. Uma solução auto-agendante (job que cria o próximo job ao terminar) seria mais complexa do que o `setInterval` existente, que já tem `FOR UPDATE SKIP LOCKED` e é seguro. Descartado.

## Impactos

### Código

- `platform/scheduling/pgboss.module.ts` — novo (provider global de `PgBoss`);
- `settlement.worker.ts` — `setInterval`/`isRunning` → `boss.schedule` + `boss.work`; `FOR UPDATE SKIP LOCKED` adicionado ao SELECT;
- `reconciliation.worker.ts` — `setInterval`/`isRunning` → `boss.schedule` + `boss.work`;
- `app.module.ts` — `PgBossModule` adicionado aos imports;
- nenhum use case, domain, migration Prisma ou contrato HTTP alterado.

### Infraestrutura

pg-boss cria e gerencia automaticamente o schema `pgboss` na primeira inicialização. Nenhum arquivo de migration Prisma necessário.

### Segurança

pg-boss usa a mesma `DATABASE_URL` do processo HTTP. Nenhuma credencial adicional.

### Escalabilidade

Com múltiplas réplicas: pg-boss garante que apenas uma réplica processa cada job via `FOR UPDATE SKIP LOCKED` interno. `SettlementWorker` também passa a usar `FOR UPDATE SKIP LOCKED` no SELECT de elegíveis.

### Migração ou reversão

Para reverter: remover `PgBossModule` do `AppModule`, restaurar `setInterval` nos dois workers. Os jobs em `pgboss.job` podem ser ignorados — não afetam dados de negócio. O schema `pgboss` pode ser dropado manualmente se desejado.

## Referências

- ADR-010 — Workers e schedulers co-localizados no processo HTTP (contexto)
- ADR-009 — Dockerfiles multi-stage portáveis
- `.ai/reports/ARCHITECTURE-CONFORMANCE-AUDIT-2026-08-26.md`
- TASK-068 — Implementação desta ADR
