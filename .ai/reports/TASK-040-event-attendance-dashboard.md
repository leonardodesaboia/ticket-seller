Relatório da TASK-040

Status

COMPLETED

Arquivos alterados

**Backend:**
- `apps/api/src/modules/checkin/domain/ports/check-in-repository.port.ts`: adicionados `AttendanceByTicketTypeRow`, `RecentCheckInRow`, `EventAttendanceData` e método `getEventAttendance()` à interface `ICheckInRepository`
- `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts`: implementado `getEventAttendance()` com SQL nativo (sem N+1), cross-tenant guard via query prévia
- `apps/api/src/modules/checkin/application/use-cases/get-event-attendance.use-case.ts`: criado — `attendanceRate` calculado como 0 quando `totalIssued = 0`, `performedByUserId` truncado para 8 chars sem dashes (ou "sistema" quando null)
- `apps/api/src/modules/checkin/application/use-cases/get-event-attendance.use-case.spec.ts`: criado — 5 testes unitários
- `apps/api/src/modules/checkin/application/use-cases/perform-check-in.use-case.spec.ts`: alterado — adicionado `getEventAttendance` ao mock (necessário pela interface extendida)
- `apps/api/src/modules/checkin/presentation/controllers/event-attendance.controller.ts`: criado — `GET /organizations/:orgId/events/:eventId/attendance` com `ActorGuard`
- `apps/api/src/modules/checkin/presentation/dto/event-attendance.response.ts`: criado
- `apps/api/src/modules/checkin/checkin.module.ts`: alterado — registrado `GetEventAttendanceUseCase` e `EventAttendanceController`
- `apps/api/test/integration/checkin/event-attendance.integration-spec.ts`: criado — 3 testes de integração

**Frontend (backoffice):**
- `apps/backoffice-web/src/shared/api/attendance.api.ts`: criado — `getEventAttendance()` com `X-Dev-User-Id`
- `apps/backoffice-web/src/features/attendance/hooks/useAttendancePolling.ts`: criado — polling 15s, pause em `visibilityState=hidden`, resume em `visible`, cleanup no unmount
- `apps/backoffice-web/src/features/attendance/hooks/useAttendancePolling.test.ts`: criado — 6 testes
- `apps/backoffice-web/src/features/attendance/components/AttendanceStats.tsx`: criado — totais e breakdown por tipo
- `apps/backoffice-web/src/features/attendance/components/AttendanceStats.test.tsx`: criado — 4 testes
- `apps/backoffice-web/src/features/attendance/components/RecentCheckIns.tsx`: criado — tabela dos últimos 20 check-ins, estado vazio
- `apps/backoffice-web/src/features/attendance/components/RecentCheckIns.test.tsx`: criado — 3 testes
- `apps/backoffice-web/src/features/attendance/components/AttendanceDashboard.tsx`: criado — Client Component compondo hook + subcomponentes
- `apps/backoffice-web/src/features/attendance/components/AttendanceDashboard.test.tsx`: criado — 4 testes
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/dashboard/page.tsx`: criado — Server Component (async params, padrão Next.js 15)

Implementado

- Endpoint `GET /api/v1/organizations/:orgId/events/:eventId/attendance` com isolamento por `organization_id`
- Métricas calculadas com SQL nativo (COUNT + GROUP BY) — sem N+1
- 20 check-ins recentes com `result='ADMITTED'`, ordenados por `checked_in_at DESC`
- `performedByUserId` truncado para 8 chars (UUID sem dashes) ou `"sistema"` quando null
- PII do comprador ausente da resposta
- Dashboard com polling 15s, pause automático quando aba oculta, retomada no foco
- Rota `/organizations/[organizationId]/events/[eventId]/dashboard` no backoffice

Decisões tomadas

- Cross-tenant guard implementado no repositório: query `SELECT id FROM events WHERE id = ? AND organization_id = ?` antes das queries de métricas — retorna `null` (→ 404 no use case) para evento de outra organização
- `performedByUserId` formatado como `.replace(/-/g, '').slice(0, 8)` — remove dashes do UUID antes de pegar 8 chars, exibe "a3b08540" em vez de "a3b08540"
- `attendanceRate = 0` quando `totalIssued = 0` — sem divisão por zero
- Interfaces `RawMetricsRow` e `RawRecentRow` declaradas no nível do módulo — evita inferência de `any` sem cliente Prisma gerado

Testes executados

Comando	Resultado
`npx prisma generate`	aprovado
`pnpm --filter @ticket-seller/api typecheck`	aprovado (0 erros)
`pnpm --filter @ticket-seller/api test`	aprovado (251 testes, 38 suites)
`pnpm --filter @ticket-seller/backoffice-web typecheck`	aprovado (0 erros)
`pnpm --filter @ticket-seller/backoffice-web test`	aprovado (96 testes, 15 suites)
`pnpm --filter @ticket-seller/marketplace-web typecheck`	aprovado (0 erros)
`pnpm --filter @ticket-seller/marketplace-web test`	aprovado (72 testes, 18 suites)

Riscos identificados

Nenhum.

Pendências

Nenhuma.

Documentação atualizada

- `.ai/reports/TASK-040-event-attendance-dashboard.md` (este arquivo)
- `docs/CURRENT_STATE.md` (a atualizar)
- `.ai/coordination/ACTIVE_TASKS.md` (a atualizar)

Próxima tarefa recomendada

A definir pelo usuário.
