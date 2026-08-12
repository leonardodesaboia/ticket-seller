# TASK-037 — Check-in Operator Interface

## Status

COMPLETED

## Objetivo

Interface de check-in no backoffice para a equipe da porta: scanner de câmera (jsQR) com fallback manual, feedback visual imediato e retorno automático ao scanner.

## Resultado observável

- Página `/organizations/[orgId]/events/[eventId]/check-in` exibe feed da câmera e decodifica QR em tempo real.
- Após scan bem-sucedido: feedback verde (ADMITTED) ou vermelho (ALREADY_CHECKED_IN / demais erros) por 2 segundos, depois retorna ao scanner.
- Se câmera negada ou indisponível: formulário manual para digitar o token.
- Offline ou erro de rede: mensagem clara — nunca simular validação sem resposta do servidor.
- Testes cobrem permissão de câmera concedida/negada, estados visuais, double scan, layout mobile e acessibilidade.

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-037-checkin-operator-ui.md`
- `apps/backoffice-web/src/shared/api/` (cliente de API existente)
- `apps/backoffice-web/src/shared/` (componentes e layout existentes)
- `apps/backoffice-web/tsconfig.json`
- `apps/backoffice-web/package.json`
- Contrato: `POST /api/v1/organizations/:orgId/events/:eventId/check-ins` (TASK-036)

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/backoffice-web/src/app/organizations/[orgId]/events/[eventId]/check-in/page.tsx`
- `apps/backoffice-web/src/features/checkin/components/CheckInPage.tsx`
- `apps/backoffice-web/src/features/checkin/components/CheckInPage.test.tsx`
- `apps/backoffice-web/src/features/checkin/components/CameraScanner.tsx`
- `apps/backoffice-web/src/features/checkin/components/CameraScanner.test.tsx`
- `apps/backoffice-web/src/features/checkin/components/ManualEntryForm.tsx`
- `apps/backoffice-web/src/features/checkin/components/ManualEntryForm.test.tsx`
- `apps/backoffice-web/src/features/checkin/components/DecisionFeedback.tsx`
- `apps/backoffice-web/src/features/checkin/components/DecisionFeedback.test.tsx`
- `apps/backoffice-web/src/shared/api/check-in.api.ts`
- `apps/backoffice-web/package.json` (somente para adicionar `jsqr`)

## Arquivos proibidos

O agente não pode alterar:

- qualquer arquivo fora do backoffice e da lista permitida;
- lockfile (instalar via `pnpm add` coordenado);
- API backend;
- módulos do marketplace;
- documentação não relacionada.

## Requisitos funcionais

- Scanner de câmera usando `jsQR` — decodifica frame a frame via `requestAnimationFrame`.
- Fallback manual: campo de texto + botão "Validar" quando câmera indisponível.
- Após decodificação ou submissão manual: chamada `POST .../check-ins`.
- Feedback por 2 segundos: verde para `ADMITTED`, vermelho para qualquer outro código.
- Texto do feedback: mensagem legível por humanos para cada `AdmissionCode`.
- Após 2 segundos: retorno automático ao scanner (câmera reativada).
- Sem conexão ou erro de rede: exibir "Sem conexão — verifique a internet" sem tentar validação local.
- Header `X-Dev-User-Id` enviado no dev (usa cliente existente do backoffice).
- `Idempotency-Key` gerado por scan para prevenir duplo envio.

## Requisitos técnicos

- `jsQR` — única biblioteca nova autorizada.
- Sem estado global — componente auto-suficiente.
- `useRef` para o elemento `<video>` e canvas de decodificação.
- Acessibilidade: `role="alert"` no feedback, `aria-live="polite"` no status, labels em todos os inputs.
- Layout responsivo — funciona em tablet e celular (equipe usa dispositivos variados).
- Testes com `jest` + `@testing-library/react` — mock de `getUserMedia` e `jsQR`.

## Invariantes

- Nunca retornar "admitido" sem resposta 200 do servidor com `allowed: true`.
- Câmera encerrada ao desmontar o componente (`stream.getTracks().forEach(t => t.stop())`).
- Token lido do QR nunca logado no console.

## Segurança

- Token do QR nunca exibido na tela nem persistido no frontend.
- Comunicação apenas com o backend via HTTPS (dev: localhost).
- Sem validação offline — toda decisão vem do servidor.

## Multi-tenancy

- `orgId` e `eventId` vêm da rota — nunca inferidos de estado global.
- Cliente de API envia `orgId` e `eventId` no path da requisição.

## Concorrência

- Double scan: `isLoading` bloqueia novo scan enquanto requisição anterior está em vio.
- Timeout de 5 segundos na requisição — se ultrapassar, exibir erro e liberar scanner.

## Idempotência

- `Idempotency-Key` gerado por `crypto.randomUUID()` para cada scan individual.
- Reenvio manual do mesmo formulário usa nova key (usuário decidiu re-enviar).

## Fora do escopo

- Autenticação real (usa `X-Dev-User-Id`).
- Histórico de check-ins na tela.
- Busca de ingresso por nome.
- Check-in manual sem QR além do fallback de texto.
- Export de dados.
- Notificação push ao comprador.

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 10, cobrindo permissão, estados, double scan, offline);
- layout funcional em 375px e 768px;
- acessibilidade: role, aria-live e labels presentes;
- nenhuma dependência adicionada além de `jsqr`;
- token do QR não aparece em tela nem em log.

## Comandos

```bash
pnpm --filter @ticket-seller/backoffice-web typecheck
pnpm --filter @ticket-seller/backoffice-web test
pnpm --filter @ticket-seller/backoffice-web build
```

## Conclusão esperada

### Arquivos alterados

- `apps/backoffice-web/src/features/checkin/`: feature completa criada
- `apps/backoffice-web/src/app/.../check-in/page.tsx`: rota criada
- `apps/backoffice-web/src/shared/api/check-in.api.ts`: cliente tipado criado
- `apps/backoffice-web/package.json`: `jsqr` adicionado

### Implementado

- Scanner de câmera com jsQR, fallback manual, feedback visual, retorno automático.

### Testes

```
pnpm test: aprovado
```

### Decisões

[a preencher pelo implementador]

### Pendências

Nenhuma.

### Próxima tarefa

TASK-038 — Ticket Transfer Foundation.
