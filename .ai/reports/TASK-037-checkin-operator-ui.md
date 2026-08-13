# Relatório da TASK-037 — Check-in Operator Interface

## Status

COMPLETED — MERGED em develop (commit 3b499c8). 36 testes unitários. Typecheck e build limpos.

## Arquivos criados

### Shared API
- `apps/backoffice-web/src/shared/api/check-in.api.ts` — cliente tipado com `X-Dev-User-Id`, `Idempotency-Key`, timeout de 5s via `AbortSignal.timeout`, `CheckInApiError`.

### Feature checkin
- `features/checkin/components/CameraScanner.tsx` — `getUserMedia({ facingMode: 'environment' })` + jsQR frame-a-frame via `requestAnimationFrame`; stream encerrado no unmount; `disabled` bloqueia scan sem parar o loop.
- `features/checkin/components/CameraScanner.test.tsx` — 5 testes.
- `features/checkin/components/ManualEntryForm.tsx` — campo com validação 64 hex; `isLoading` desabilita input e botão.
- `features/checkin/components/ManualEntryForm.test.tsx` — 8 testes.
- `features/checkin/components/DecisionFeedback.tsx` — verde (✓) para `ADMITTED`, vermelho (✗) para demais; `role="alert"`; 7 mensagens pt-BR; retorna `null` quando `decision === null`.
- `features/checkin/components/DecisionFeedback.test.tsx` — 12 testes.
- `features/checkin/components/CheckInPage.tsx` — máquina de estado: `SCANNING → VALIDATING → FEEDBACK → SCANNING` (2s); `OFFLINE` em erro de rede; `CAMERA_ERROR` exibe `ManualEntryForm`; `Idempotency-Key` único por scan.
- `features/checkin/components/CheckInPage.test.tsx` — 11 testes.

### Rota
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/check-in/page.tsx` — Server Component passando `orgId` e `eventId` para `CheckInPage`.

### Dependência adicionada
- `jsqr: ^1.4.0` em `apps/backoffice-web/package.json`.

## Implementado

- Scanner de câmera com jsQR + fallback manual.
- Feedback visual 2 segundos com retorno automático ao scanner.
- Bloqueio de double scan durante requisição.
- Detecção de offline com mensagem clara.
- Token do QR nunca exibido em tela nem logado.

## Decisões tomadas

1. Callbacks `onScan`/`onCameraError` mantidos em refs dentro de `CameraScanner` — evita reinício da câmera a cada re-render sem `eslint-disable`.
2. `jest.mock` usa caminho relativo no `CheckInPage.test.tsx` — hoisting do Jest ocorre antes do moduleNameMapper resolver aliases `@/`.
3. Erros de rede: `instanceof TypeError` (fetch falhou) ou `err.name === 'TimeoutError'/'AbortError'` → estado `OFFLINE`.
4. Erros HTTP 4xx/5xx → scanner volta para `SCANNING` (decisão do servidor, não offline).

## Testes executados

| Componente | Testes | Resultado |
|---|---|---|
| DecisionFeedback | 12 | ✅ |
| ManualEntryForm | 8 | ✅ |
| CameraScanner | 5 | ✅ |
| CheckInPage | 11 | ✅ |
| Pré-existentes | 24 | ✅ |
| **Total** | **60** | **✅** |

| Comando | Resultado |
|---|---|
| `pnpm --filter @ticket-seller/backoffice-web typecheck` | aprovado |
| `pnpm --filter @ticket-seller/backoffice-web test` | aprovado (60 total) |
| `pnpm --filter @ticket-seller/backoffice-web build` | aprovado |

## Riscos identificados

- `DevelopmentActorAdapter` (`X-Dev-User-Id`) é bloqueador de produção.
- `AbortSignal.timeout` requer Node ≥ 17 / browsers modernos.

## Pendências

Nenhuma.

## Documentação atualizada

- `.ai/tasks/TASK-037-checkin-operator-ui.md` — status COMPLETED.

## Próxima tarefa recomendada

TASK-038 — Ticket Transfer Foundation.
