ADR-010 — Workers e schedulers co-localizados no processo HTTP com locks de banco

Status

PROPOSED

Data

2026-08-27

Contexto

Três workers de polling existem no código da API, todos registrados como providers NestJS no mesmo processo HTTP:

| Worker | Módulo | Intervalo | Proteção de reentrância |
|---|---|---|---|
| `SettlementWorker` | finance | 1 hora | `isRunning` (in-process apenas) |
| `ReconciliationWorker` | finance | 15 minutos | `isRunning` + `FOR UPDATE SKIP LOCKED` |
| `OutboxNotificationWorker` | notifications | 5 segundos | `isPolling` + `FOR UPDATE SKIP LOCKED` |

A auditoria TASK-066 classificou essa co-localização como risco arquitetural Alto e bloqueou a Fase 4 até a aprovação desta ADR. As questões a decidir são:

1. **Entrypoints**: workers ficam no mesmo processo do HTTP ou são extraídos para um processo/container separado?
2. **Locks**: qual mecanismo garante exatamente-uma execução com múltiplas réplicas?
3. **Retry e DLQ**: o que acontece quando uma tarefa falha repetidamente?
4. **Observabilidade**: como detectar workers presos ou atrasados?

Contexto adicional: o projeto opera com até 100 usuários ativos simultâneos (MVP); a meta de escalabilidade é horizontal com Docker/Kubernetes sem troca de infraestrutura; Redis está na infra (cache/rate-limiting) mas sem RabbitMQ ou SQS; não há sistema de filas dedicado.

Decisão

**1. Workers ficam no processo HTTP (co-localização) para o MVP.**

Nenhum container ou processo separado será criado para os workers. Cada instância do container HTTP executa os três workers via `OnModuleInit`/`OnModuleDestroy` do NestJS.

**2. `FOR UPDATE SKIP LOCKED` é a garantia de exatamente-uma-execução com múltiplas réplicas.**

Todos os workers que podem rodar em mais de uma réplica DEVEM usar `FOR UPDATE SKIP LOCKED` no SELECT que busca itens a processar. O `isRunning`/`isPolling` protege apenas contra reentrância dentro de um único processo — não substitui o lock de banco com múltiplas réplicas.

Estado atual por worker:
- `OutboxNotificationWorker`: ✓ usa `FOR UPDATE SKIP LOCKED` + deduplicação via `notification_log`
- `ReconciliationWorker`: ✓ usa `FOR UPDATE SKIP LOCKED` no SELECT de payouts + re-check sob lock em `handleSucceeded`/`handleFailed`
- `SettlementWorker`: usa `isRunning` apenas no poll. A **corretude** com múltiplas réplicas já é garantida por duas camadas dentro de `settle-order.use-case`: (a) `SELECT FOR UPDATE on seller_balance` serializa settlements concorrentes para a mesma organização; (b) `INSERT INTO balance_settlements ... ON CONFLICT (order_id) DO NOTHING` garante que o duplo processamento é um no-op. Sem `FOR UPDATE SKIP LOCKED` no SELECT de elegíveis, duas réplicas buscarão os mesmos pedidos e a segunda chegará ao use case — que os descartará sem efeito colateral. O resultado é buscas duplicadas desnecessárias, não corrupção de dados.

**Topologia de deploy verificada**: `docker-compose.prod.yml` não define `replicas` (padrão = 1); o cabeçalho do arquivo afirma explicitamente "single-server deployment". A co-localização com réplica única é o deploy atual e documentado, não uma suposição.

**3. Política de retry e DLQ.**

| Worker | Falha em item individual | Retry | DLQ |
|---|---|---|---|
| `SettlementWorker` | log de erro; pedido fica elegível | próxima poll (1h) | nenhum — log é o DLQ |
| `ReconciliationWorker` | log de erro; payout fica elegível | próxima poll (15min) se ainda PROCESSING + stuckMinutes | nenhum — log é o DLQ |
| `OutboxNotificationWorker` | `failed_at` gravado na mesma transação; evento excluído de futuros polls | sem retry automático | nenhum — `failed_at` é o DLQ; reprocessamento manual via reset de `failed_at = NULL` |

Não será criado um sistema de DLQ externo para o MVP. A política é: falhas individuais são absorvidas por idempotência ou `failed_at`; falhas de poll inteiras são logadas e retentadas no próximo intervalo.

**4. Observabilidade mínima para MVP.**

Os workers já emitem logs estruturados via `Logger` do NestJS. Em produção, logs são exportados para o sistema de observabilidade centralizado (ADR-009). Não serão criados métricas ou health checks dedicados para workers no MVP — o sinal de degradação é `failed_at IS NOT NULL` em `outbox_events` consultado manualmente ou via alerta externo no log.

Critérios que justificam extração de workers para processo separado (pós-MVP):
- volume de settlements > 500/hora (poll de 1h com chunk 50 se torna inadequado)
- latência de notificação > 10s passa a ser SLA formal
- necessidade de escalar workers independentemente do HTTP
- qualquer worker precisar de recursos (CPU/memória) que afete o latency do HTTP

Razões

**Insight fundamental**: a atomicidade financeira reside na camada de use case/adapter (`FOR UPDATE` + `ON CONFLICT` + re-check sob lock), não na camada de scheduling. A escolha entre co-localizado vs. processo separado é, portanto, puramente operacional — sem stake de corretude — o que é exatamente o motivo pelo qual co-localização é segura para o MVP.

simplicidade de deploy — um container, uma imagem, um Dockerfile (alinhado com ADR-009);
outbox e `FOR UPDATE SKIP LOCKED` já proveem durabilidade e exatamente-uma-execução sem infraestrutura adicional;
volume do MVP não justifica BullMQ, Redis Streams, SQS ou processo separado;
cada worker falha isoladamente — uma exception em `SettlementWorker.poll()` não propaga para o HTTP handler;
`app.enableShutdownHooks()` + `OnModuleDestroy` para todos os workers: `clearInterval` impede que novos polls comecem após SIGTERM. Polls *já em andamento* completam de forma assíncrona — o graceful shutdown do Kubernetes (30s padrão) é suficiente para a maioria das execuções, mas não é uma garantia formal de drenagem.

Consequências positivas

nenhuma infraestrutura nova (sem Redis, RabbitMQ, BullMQ) até o MVP atingir os critérios de extração;
deploy e rollback são operações únicas sobre o container HTTP;
testes de integração dos workers podem usar `PrismaService` real via `@nestjs/testing` sem mocks adicionais;
a co-localização permite que workers compartilhem o pool de conexões do `PrismaService`.

Consequências negativas

reiniciar o processo HTTP interrompe workers em execução (mitigado por graceful shutdown + idempotência de retry);
**setInterval não é durável — cada deploy, OOM ou crash reseta o relógio**: `SettlementWorker` (1h) e `ReconciliationWorker` (15min) só executam pela primeira vez após seu intervalo completo desde o boot. Em ambientes com deploys frequentes, o settlement pode ser atrasado indefinidamente; este é o argumento mais forte a favor de um scheduler durável (pg-boss) quando a cadência de deploy aumentar;
escalar horizontalmente o HTTP escala também os workers — exige `FOR UPDATE SKIP LOCKED` em todos (SettlementWorker é o único que ainda não tem no SELECT de elegíveis);
um worker em loop com erro de banco pode consumir conexões do pool e degradar o HTTP;
sem métricas, workers presos são detectáveis apenas por log.

Alternativas consideradas

Processo separado (worker Dockerfile distinto)

Rejeitado para MVP: adiciona complexidade de orquestração (segundo Deployment no Kubernetes, segundo build, segundo log stream) sem benefício proporcional ao volume atual.

BullMQ com Redis

Considerado mas não adotado: Redis *já está* na infra (`compose.yaml` + `docker-compose.prod.yml`) para cache/rate-limiting. BullMQ poderia ser adicionado sem nova dependência de infraestrutura, mas adicionaria responsabilidade nova ao Redis (filas de jobs) sem necessidade imediata — e sem Lua scripting ou configuração de persistência adequada, filas Redis perdem jobs em crashes. A ADR que impede Redis como *fonte de estoque* não veta Redis para filas; a decisão aqui é de escopo, não de proibição arquitetural.

pg-boss (job queue sobre PostgreSQL)

Considerado como alternativa futura: elimina `setInterval` artesanal e provê retry, DLQ e métricas com o PostgreSQL existente. Não adotado agora para evitar dependência nova sem necessidade imediata — pode ser avaliado se os critérios de extração forem atingidos.

Cron externo (Kubernetes CronJob)

Rejeitado: requer imagem Docker separada ou endpoint HTTP interno acionável; complica o deploy e expõe superfície interna.

Impactos

Código

Nenhuma alteração imediata necessária para o MVP.

**Otimização de eficiência (não requisito de corretude)**: adicionar `FOR UPDATE SKIP LOCKED` ao `fetchEligibleOrders` do `SettlementWorker` antes de habilitar múltiplas réplicas HTTP elimina buscas duplicadas custosas. A corretude com múltiplas réplicas já é garantida por `ON CONFLICT (order_id) DO NOTHING` + `SELECT FOR UPDATE on seller_balance` dentro do use case — sem SKIP LOCKED, duas réplicas processarão os mesmos pedidos e a segunda descartará silenciosamente os conflitos sem efeito colateral. SKIP LOCKED é uma otimização que deve ser aplicada antes de escalar, não um gate de corretude.

Infraestrutura

Nenhuma infraestrutura adicional. Workers são provisionados automaticamente com cada réplica HTTP.

Segurança

Workers operam com as mesmas credenciais de banco do processo HTTP (mesmo `DATABASE_URL`). Nenhuma credencial adicional necessária.

Migração ou reversão

Para extrair um worker para processo separado: criar `apps/worker/` com entrypoint NestJS próprio, mover o módulo correspondente, remover do `AppModule` do HTTP. O outbox continua sendo o contrato — nenhuma alteração no módulo de origem.
Para resetar evento com `failed_at`: `UPDATE outbox_events SET failed_at = NULL, attempts = 0 WHERE id = ?`.
Para adicionar métricas: instrumentar `poll()` de cada worker com Prometheus counters via `@willsoto/nestjs-prometheus` (sem impacto no contrato HTTP).

Referências

ADR-005 — Confirmação de pagamento e emissão atômica de ingressos (padrão outbox)
ADR-006 — Notificações transacionais via worker de polling do outbox
ADR-009 — Dockerfiles multi-stage portáveis
TASK-066 — Conformidade Arquitetura Hexagonal (Fase 4 bloqueada por esta ADR)
`.ai/reports/ARCHITECTURE-CONFORMANCE-AUDIT-2026-08-26.md`
