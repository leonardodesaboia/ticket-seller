# TASK-040 — Event Attendance & Operations Dashboard

## Status

PLANNED

## Objetivo

Dashboard operacional de evento no backoffice para o produtor: métricas de presença em tempo real (polling 15s), por tipo de ingresso e histórico recente de check-ins.

## Resultado observável

- Página `/organizations/[orgId]/events/[eventId]/dashboard` exibe:
  - Total de tickets emitidos, total de ADMITTED, restantes e percentual de presença.
  - Breakdown por tipo de ingresso.
  - Tabela com os últimos 20 check-ins (horário, código do tipo, operador — sem PII do comprador).
  - Polling automático a cada 15 segundos.
- Evento sem check-ins: métricas com zero, tabela vazia.
- Acesso cruzado (outro `orgId`): dados não exibidos (API retorna 404/403).
- Testes: métricas corretas, isolamento por org, zero participantes, polling.

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-040-event-operations-dashboard.md`
- `apps/backoffice-web/src/shared/api/` (cliente existente)
- `apps/backoffice-web/src/features/` (padrão de features existente)
- `apps/api/src/modules/checkin/` (estrutura do módulo)
- `apps/api/src/modules/tickets/` (estrutura do módulo)
- Contrato: endpoint de métricas a ser criado nesta task

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/api/src/modules/checkin/application/use-cases/get-event-attendance.use-case.ts`
- `apps/api/src/modules/checkin/application/use-cases/get-event-attendance.use-case.spec.ts`
- `apps/api/src/modules/checkin/presentation/controllers/event-attendance.controller.ts`
- `apps/api/src/modules/checkin/presentation/dto/event-attendance.response.ts`
- `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts`
- `apps/api/src/modules/checkin/checkin.module.ts`
- `apps/api/test/integration/checkin/event-attendance.integration-spec.ts`
- `apps/backoffice-web/src/shared/api/attendance.api.ts`
- `apps/backoffice-web/src/features/attendance/components/AttendanceDashboard.tsx`
- `apps/backoffice-web/src/features/attendance/components/AttendanceDashboard.test.tsx`
- `apps/backoffice-web/src/features/attendance/components/AttendanceStats.tsx`
- `apps/backoffice-web/src/features/attendance/components/AttendanceStats.test.tsx`
- `apps/backoffice-web/src/features/attendance/components/RecentCheckIns.tsx`
- `apps/backoffice-web/src/features/attendance/components/RecentCheckIns.test.tsx`
- `apps/backoffice-web/src/features/attendance/hooks/useAttendancePolling.ts`
- `apps/backoffice-web/src/features/attendance/hooks/useAttendancePolling.test.ts`
- `apps/backoffice-web/src/app/organizations/[orgId]/events/[eventId]/dashboard/page.tsx`

## Arquivos proibidos

O agente não pode alterar:

- migrations (dados já existem em `check_ins` e `tickets`);
- módulos fora de `checkin/` no backend;
- módulos do marketplace;
- lockfile;
- documentação não relacionada.

## Requisitos funcionais

- **Backend** — `GET /api/v1/organizations/:orgId/events/:eventId/attendance`:
  - Autenticado por `ActorGuard`.
  - Retorna: `{ totalIssued, totalAdmitted, totalRemaining, attendanceRate, byTicketType: [...], recentCheckIns: [...] }`.
  - `recentCheckIns`: últimos 20 check-ins com `result='ADMITTED'`, campos: `checkedInAt`, `ticketTypeName`, `performedByUserId`.
  - Sem PII do comprador (sem nome, email, CPF).
  - Filtra por `organization_id` — isolamento garantido no SQL.

- **Frontend** — `AttendanceDashboard`:
  - Polling a cada 15 segundos via `useAttendancePolling`.
  - Pause quando `document.visibilityState === 'hidden'`.
  - Contador de presença com percentual.
  - Tabela `RecentCheckIns` com horário local.

## Requisitos técnicos

- Query de métricas em SQL nativo com COUNT e GROUP BY — sem N+1.
- `attendanceRate = totalAdmitted / totalIssued * 100` — 0 quando `totalIssued = 0`.
- `recentCheckIns` limitados a 20, ordenados por `checked_in_at DESC`.
- Polling: `setInterval` com 15000ms, limpo no unmount.
- `performedByUserId` exibido como UUID curto (primeiros 8 chars) — sem busca de nome nesta task.

## Invariantes

- Métricas sempre consistentes com o estado do banco no momento da query.
- `attendanceRate` nunca ultrapassa 100% (invariante de negócio).
- Dados de outro `orgId` nunca aparecem (SQL filtra `organization_id`).
- PII do comprador nunca na resposta.

## Segurança

- Autenticação por `ActorGuard`.
- Cross-tenant: SQL filtra `organization_id` além de `event_id`.
- `performedByUserId` parcial — não expõe UUID completo desnecessariamente.

## Multi-tenancy

- `organization_id` obrigatório no path e em todas as queries.
- Evento de outra organização → 404 (indistinguível de não-encontrado).

## Concorrência

Não aplicável: endpoint de leitura apenas, sem escrita.

## Idempotência

Não aplicável: GET idempotente por natureza.

## Fora do escopo

- Exportação CSV.
- Reversão de check-in.
- Check-in manual pelo dashboard.
- Gráfico de check-ins por hora.
- Nome do operador (exibe UUID parcial no MVP).
- Filtro por período.

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários de use case aprovados (mínimo 3: métricas corretas, zero participantes, isolamento);
- testes de integração do endpoint aprovados (mínimo 3);
- testes de componentes aprovados (mínimo 6: stats, tabela, polling, zero, isolamento, pause ao ocultar);
- PII do comprador ausente da resposta;
- nenhuma dependência adicionada sem justificativa.

## Comandos

```bash
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration
pnpm --filter @ticket-seller/backoffice-web typecheck
pnpm --filter @ticket-seller/backoffice-web test
pnpm build
```

## Conclusão esperada

### Arquivos alterados

- `apps/api/src/modules/checkin/application/use-cases/get-event-attendance.use-case.ts`: criado
- `apps/api/src/modules/checkin/presentation/controllers/event-attendance.controller.ts`: criado
- `apps/api/test/integration/checkin/event-attendance.integration-spec.ts`: criado
- `apps/backoffice-web/src/features/attendance/`: feature completa criada
- `apps/backoffice-web/src/app/.../dashboard/page.tsx`: rota criada

### Implementado

- Endpoint de métricas de presença por evento.
- Dashboard com polling 15s, stats e tabela de check-ins recentes.

### Testes

```
pnpm test:              aprovado
pnpm test:integration:  aprovado
```

### Decisões

[a preencher pelo implementador]

### Pendências

Nenhuma.

### Próxima tarefa

A definir pelo usuário.
