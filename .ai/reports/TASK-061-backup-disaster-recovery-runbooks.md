# TASK-061 — Backup, Disaster Recovery & Operational Runbooks

Data: 2026-08-24

## Arquivos criados

- `docs/operations/backup-strategy.md` — frequência, retenção, restore test, RPO/RTO summary
- `docs/runbooks/overview.md` — tabela de RPO/RTO, índice de runbooks, princípios gerais
- `docs/runbooks/db-unavailable.md` — banco inacessível: diagnóstico, 4 casos de resolução, escalação
- `docs/runbooks/worker-stopped.md` — workers parados: tabela de workers, diagnóstico, resolução
- `docs/runbooks/outbox-backlog.md` — fila acumulando: queries de diagnóstico, 4 casos de resolução
- `docs/runbooks/payout-stuck.md` — payout em PROCESSING: diagnóstico por provider, 4 casos
- `docs/runbooks/payment-webhook-delayed.md` — webhook atrasado: diagnóstico PSP, 4 casos de resolução
- `docs/runbooks/restore-database.md` — restore completo: 10 steps, validação SQL, smoke test

## Sem alterações de código

Esta task produziu apenas documentação. `pnpm lint` não tem nada novo para verificar.

## Decisões

- Runbooks seguem estrutura uniforme: Sintomas → Diagnóstico (com queries SQL) → Resolução por caso → Pós-incidente.
- `restore-database.md` cobre duas opções: restore em novo banco (para validação prévia) e restore in-place.
- Ledger é explicitamente protegido: "Never adjust `ledger_entries` directly" aparece em todos os runbooks financeiros.
- Redis: RPO = 0 aceitável (efêmero); sem backup necessário no MVP.
- `docs/operations/` criada como nova pasta para documentos operacionais não-arquiteturais.

## Pendências

Nenhuma.

## Próxima tarefa

TASK-062 — Release Readiness & E2E Certification
