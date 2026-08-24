TASK-061 — Backup, Disaster Recovery & Operational Runbooks

Status: CONCLUÍDA

Objetivo

Documentar a estratégia completa de backup, os objetivos de RPO/RTO por cenário, e criar os runbooks operacionais para as falhas mais prováveis em produção. Nenhuma alteração de código.

Resultado observável

- `docs/operations/backup-strategy.md` documenta frequência de backup, retenção, procedimento de restore e RPO/RTO.
- `docs/runbooks/overview.md` com tabela de RPO/RTO e referências cruzadas.
- `docs/runbooks/db-unavailable.md` — banco inacessível.
- `docs/runbooks/worker-stopped.md` — worker(s) parado(s).
- `docs/runbooks/outbox-backlog.md` — fila de outbox acumulando.
- `docs/runbooks/payout-stuck.md` — payout travado em PROCESSING.
- `docs/runbooks/payment-webhook-delayed.md` — webhook de pagamento atrasado.
- `docs/runbooks/restore-database.md` — procedimento de restore completo.
- `pnpm lint` aprovado (nenhum código alterado).

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-061-backup-disaster-recovery-runbooks.md
- docs/ARCHITECTURE.md
- apps/api/src/modules/finance/infrastructure/workers/ (referência dos workers existentes)
- apps/api/src/modules/notifications/infrastructure/workers/ (referência dos workers existentes)

Sem código alterado

Esta task produz apenas documentação em `docs/`.

Arquivos permitidos

- docs/operations/ (NOVA pasta)
  - backup-strategy.md
- docs/runbooks/ (pasta criada na fase de planejamento)
  - overview.md
  - db-unavailable.md
  - worker-stopped.md
  - outbox-backlog.md
  - payout-stuck.md
  - payment-webhook-delayed.md
  - restore-database.md

RPO / RTO por cenário

| Cenário | RPO | RTO | Impacto |
|---------|-----|-----|---------|
| Falha de processo da API | 0 (stateless) | < 5min (restart) | Requests em flight perdidas |
| Falha de worker | 0 (outbox persiste) | < 5min (restart) | Atraso em emails/reconciliação |
| Falha de banco (instância) | < 1h (backup horário) | < 30min (failover ou restore) | Indisponibilidade total |
| Falha de banco (corrupção) | < 6h (backup periódico) | < 2h (restore PiTR) | Perda de dados parcial |
| Falha de object storage | 0 (uploads bloqueados) | < 1h (failover ou degraded mode) | Uploads indisponíveis; dados existentes ok |

Estratégia de backup

Banco de dados:
- Backups automáticos a cada 6h via pg_dump (ou PITR nativo do managed PostgreSQL).
- Retenção: 30 dias.
- Armazenamento: bucket S3/object storage separado do da aplicação.
- Teste de restore: mensal em banco isolado (sandbox), com verificação de integridade de 10 registros aleatórios por tabela crítica (orders, ledger_entries, payouts).
- Chave de criptografia dos backups separada das credenciais da aplicação.

Object storage:
- Versionamento ativado no bucket (evita exclusão acidental de arquivos).
- Cross-region replication (se budget permitir) ou snapshot diário do volume.
- Não é fonte de verdade de dados de negócio — apenas mídia; perda de arquivo = perda de imagem, não de transação.

Redis:
- Usado apenas para throttling (TASK-057) e sessions em cache.
- RPO = 0 aceitável (dados efêmeros — throttle reset em falha; sessions re-autenticadas).
- Sem backup necessário no MVP.

Runbook: db-unavailable.md

Sintomas: API retornando 503 em /health/ready; erros `P1001 Can't reach database server`.

Diagnóstico:
1. Verificar logs da API: `docker logs api | grep -i prisma`.
2. Verificar se PostgreSQL está rodando: `docker ps | grep postgres` ou equivalente managed.
3. Testar conexão: `psql $DATABASE_URL -c "SELECT 1"`.
4. Verificar espaço em disco do servidor.

Resolução:
- Instância gerenciada: verificar console do provider, iniciar instância se parada.
- Self-hosted: `docker start postgres` ou `systemctl start postgresql`.
- Espaço em disco: liberar logs, aumentar volume.

Rollback: sem rollback — banco é stateful. Escalar para restore se não recuperado em 30min.

Runbook: worker-stopped.md

Workers monitorados: OutboxWorker, SettlementWorker, ReconciliationWorker, OutboxNotificationWorker.

Sintomas: emails não enviados, payouts não reconciliados, settlements atrasados.

Diagnóstico:
1. `docker logs api | grep "Worker"` — verificar last heartbeat.
2. Verificar tabela `outbox_events WHERE processed_at IS NULL AND created_at < now() - interval '30 min'`.
3. Verificar `balance_settlements WHERE created_at < now() - 8 days` (atraso de settlement).

Resolução: reiniciar container da API (`docker restart api`). Workers são `OnModuleInit` — reiniciam com o módulo.

Runbook: outbox-backlog.md

Alerta: > 1000 eventos em outbox_events com processed_at IS NULL por mais de 10min.

Diagnóstico:
1. Query: `SELECT COUNT(*) FROM outbox_events WHERE processed_at IS NULL AND failed_at IS NULL`.
2. Verificar se OutboxWorker está rodando (ver worker-stopped).
3. Verificar se SMTP/Resend está respondendo: testar endpoint de email.
4. Verificar logs de failed_at: `SELECT * FROM outbox_events WHERE failed_at IS NOT NULL ORDER BY failed_at DESC LIMIT 10`.

Resolução:
- Workers parados: reiniciar API.
- Provider de email com falha: verificar credenciais e quota do RESEND_API_KEY.
- Reset de failed_at para reprocessamento: `UPDATE outbox_events SET failed_at = NULL WHERE failed_at IS NOT NULL AND processed_at IS NULL` (usar com cautela — reprocessa todos).

Runbook: payout-stuck.md

Sintomas: payout com status PROCESSING há mais de 1h; ReconciliationWorker emitiu finance.reconciliation-mismatch.v1.

Diagnóstico:
1. Query: `SELECT id, external_payout_id, status, requested_at FROM payouts WHERE status = 'PROCESSING' AND requested_at < now() - interval '1 hour'`.
2. Verificar log do ReconciliationWorker: `docker logs api | grep reconciliation`.
3. Consultar status diretamente no provider (dashboard do FakePayoutGateway ou provider real).

Resolução:
- Provider retornou SUCCEEDED mas webhook não chegou: inserir payout_webhook_event manualmente (via script SQL ou endpoint de admin).
- Provider retornou FAILED: idem.
- Divergência de amount: escalar para revisão manual — nunca ajustar ledger diretamente. Criar FinancialAdjustment (futura feature) ou documentar como AuditEntry.

Runbook: payment-webhook-delayed.md

Sintomas: order em PROCESSING há mais de 30min; pagamento aprovado no PSP mas order não confirmada.

Diagnóstico:
1. Query: `SELECT id, status, created_at FROM orders WHERE status = 'PROCESSING' AND created_at < now() - interval '30 min'`.
2. Verificar outbox_events para webhook do PSP: `SELECT * FROM outbox_events WHERE event_type = 'order.paid.v1'`.
3. Verificar logs de webhook: `docker logs api | grep webhook`.
4. Consultar PSP: verificar se webhook foi enviado e qual o status.

Resolução:
- Reenviar webhook manualmente (via PSP dashboard).
- Forçar re-entrega se PSP suportar.
- Em último caso: atualizar order via script — documentar como AuditEntry com reason.

Runbook: restore-database.md

Procedimento de restore completo:

1. Parar a API e workers: `docker stop api` (evitar writes durante restore).
2. Identificar o backup: listar backups disponíveis no storage, escolher o mais recente antes do incidente.
3. Criar banco temporário para validação: `createdb ticket_seller_restore`.
4. Restaurar: `pg_restore -d ticket_seller_restore < backup_file.dump`.
5. Validar integridade:
   - `SELECT COUNT(*) FROM orders WHERE status = 'CONFIRMED'` — comparar com antes do incidente.
   - `SELECT COUNT(*) FROM ledger_entries` — não deve ser menor que antes.
   - `SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5` — verificar migrations.
6. Se válido: renomear banco (ou apontar DATABASE_URL para banco restaurado).
7. Reiniciar API.
8. Executar smoke test: health/ready, login, listar eventos.
9. Documentar: data/hora do restore, backup utilizado, dados perdidos (window entre último backup e incidente).

Fora do escopo

- Disaster Recovery automatizado (failover automático).
- Multi-region active-active.
- Chaos Engineering.
- Runbook para falha de CDN ou load balancer.

Critérios de aceite

- Todos os 7 arquivos de runbook criados em docs/runbooks/.
- docs/operations/backup-strategy.md criado.
- Cada runbook tem: sintomas, diagnóstico com queries SQL, resolução step-by-step, e escalação.
- `pnpm lint` aprovado (apenas documentação alterada).

Comandos

```bash
ls docs/runbooks/
ls docs/operations/
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento — documentação]
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-062 — Release Readiness & E2E Certification.
