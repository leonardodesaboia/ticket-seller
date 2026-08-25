# Revisão de Módulo — notifications

**Data:** 2026-08-25
**Revisor:** Claude Sonnet 4.6 (análise automatizada)
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

O módulo `notifications` tem estrutura de portas/adapters bem aplicada e idempotência parcialmente implementada. O mecanismo de deduplicação funciona para o caminho feliz, mas apresenta **race condition clássica** entre checagem e `record`, que pode resultar em emails duplicados em alta concorrência. O problema mais grave é a **ausência de lock distribuído no worker** — em qualquer deploy com mais de uma réplica, o mesmo outbox event será processado por todas as instâncias simultaneamente. Foram identificados **2 bloqueantes**, **4 altos**, **5 médios** e **4 baixos**.

---

## Problemas por Severidade

### BLOQUEANTE

#### BL1 — `outbox-notification.worker.ts:5-8`: Endereços de e-mail hardcoded de desenvolvimento usados em produção

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** linhas 5–8
```ts
const DEV_BUYER_EMAIL = "comprador@ticket-seller.local";
const DEV_ADMIN_EMAIL = "backoffice@ticket-seller.local";
```
**Problema:** Endereços de e-mail hardcoded substituem o destinatário real em todos os eventos. Nenhum comprador real receberá uma notificação enquanto esse código estiver ativo.
**Impacto:** Em produção, 100% das notificações (order.paid, order.cancelled, order.refunded, order.chargeback) vão para endereços fictícios. Falha funcional completa para o usuário final.
**Correção recomendada:** O payload dos eventos de outbox deve incluir o e-mail do comprador (ex.: `payload["buyerEmail"]`). O worker deve ler esse campo. O comentário `NOTE (TASK-045 MVP)` indica que a intenção era corrigir isso; a tarefa precisa ser encerrada com a implementação real.

---

#### BL2 — `outbox-notification.worker.ts:52-73`: Worker sem lock distribuído — eventos processados em duplicata em múltiplos pods

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** linhas 52–73
```ts
const rows = await this.prisma.$queryRaw<OutboxEventRow[]>`
  SELECT id, type, payload, organization_id
  FROM outbox_events
  WHERE type = ANY(${HANDLED_TYPES}::text[])
    AND processed_at IS NULL
    AND failed_at IS NULL
  ORDER BY occurred_at ASC
  LIMIT 10
`;
```
**Problema:** A query seleciona os eventos mas não os marca como "em processamento" — sem `SELECT FOR UPDATE SKIP LOCKED` ou coluna `locked_at`. Em múltiplas instâncias, o mesmo evento pode ser processado concorrentemente por dois workers simultaneamente.
**Impacto:** Duplicação de e-mails enviados. A idempotência do `notification_log` mitiga parcialmente, mas a janela de corrida existe entre a leitura e o registro.
**Correção recomendada:** Usar `SELECT ... FOR UPDATE SKIP LOCKED` dentro de uma transação, ou adicionar coluna `locked_until` ao outbox, marcando os eventos antes de processá-los.

---

### ALTO

#### A1 — `resend-email.adapter.ts:23`: Endereço `from` hardcoded no adapter de produção

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/resend-email.adapter.ts`
**Trecho:** linha 23
```ts
from: 'noreply@ticket-seller.com',
```
**Problema:** O endereço remetente está hardcoded no adapter de produção. O adapter do Mailpit usa corretamente `env.SMTP_FROM`, mas o adapter de produção ignora essa variável.
**Impacto:** Impossível mudar o remetente sem deploy. Pode causar rejeição se o domínio não estiver verificado no Resend.
**Correção recomendada:** Usar `env.RESEND_FROM ?? 'noreply@ticket-seller.com'` ou adicionar uma variável `RESEND_FROM` ao schema de env.

---

#### A2 — `outbox-notification.worker.ts:100-115`: `processed_at` atualizado fora da transação de envio

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** linhas 100–115
**Problema:** As atualizações de `processed_at` e `failed_at` não estão dentro da mesma transação que o processamento do evento. Se a aplicação travar após `send()` mas antes do `UPDATE outbox_events SET processed_at`, o evento será processado novamente no próximo ciclo.
**Impacto:** E-mails duplicados em caso de crash entre envio e commit.
**Correção recomendada:** Envolver `processEvent` + `UPDATE outbox_events` em `this.prisma.$transaction([...])`.

---

#### A3 — `notification.errors.ts`: `NotificationAlreadySentError` nunca lançado — código morto

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/notifications/domain/notification.errors.ts`
**Trecho:** linhas 9–14
**Problema:** `NotificationAlreadySentError` é declarado mas nunca lançado em nenhum lugar do módulo. O `SendEmailUseCase` usa `return` silencioso ao detectar duplicata, nunca lança este erro. A classe é código morto.
**Impacto:** Erro de domínio não utilizado gera confusão sobre o contrato do use case. Callers que tentarem capturar esse erro nunca o receberão.
**Correção recomendada:** Ou lançar `NotificationAlreadySentError` no `SendEmailUseCase` em vez do `return` silencioso, ou remover a classe.

---

#### A4 — `outbox-notification.worker.ts:192-201`: `Number()` para valor monetário — perda de precisão

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** linhas 192–201
```ts
const amountRaw = payload["amount"] as string | number | undefined;
const units = BigInt(Math.trunc(Number(amountRaw)));
```
**Problema:** `Number(amountRaw)` pode perder precisão para valores monetários grandes (> 2^53 centavos). A conversão pelo tipo `number` é antipadrão para valores monetários que chegam como string.
**Impacto:** Valor incorreto exibido no e-mail de reembolso para valores acima do limite de precisão do `number`.
**Correção recomendada:** Usar `BigInt(String(amountRaw))` diretamente, sem passar por `Number`.

---

### MÉDIO

#### M1 — `notifications.infrastructure.module.ts`: Adapters concretos exportados — viola inversão de dependência

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/notifications.infrastructure.module.ts`
**Trecho:** linhas 26–33
**Problema:** O módulo exporta `MailpitEmailAdapter` e `ResendEmailAdapter` diretamente, além do token `EMAIL_PROVIDER`. Módulos externos poderiam injetar diretamente o adapter concreto, bypassando a factory de seleção.
**Impacto:** Acoplamento acidental a implementações de infraestrutura por módulos consumidores.
**Correção recomendada:** Exportar apenas `EMAIL_PROVIDER` e `NOTIFICATION_LOG_REPOSITORY`. Remover os adapters concretos dos exports.

---

#### M2 — `outbox-notification.worker.ts`: Intervalo de polling hardcoded

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** `private readonly pollIntervalMs = 5_000;`
**Problema:** O intervalo de polling (5s) está hardcoded na classe. Para ajustar a frequência em produção é necessário um novo deploy.
**Impacto:** Inflexibilidade operacional.
**Correção recomendada:** Ler de `env.OUTBOX_POLL_INTERVAL_MS ?? 5000`.

---

#### M3 — `send-email.use-case.spec.ts`: Teste documenta e aceita envio sem idempotência

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.spec.ts`
**Trecho:** linhas 93–106
**Problema:** O teste aceita o comportamento de envio sem nenhuma garantia de idempotência quando nem `orderId` nem `outboxEventId` são fornecidos, validando-o como correto sem nenhum comentário sobre o risco.
**Impacto:** Qualquer caller que omita ambos os campos enviará e-mails duplicados sem qualquer proteção.
**Correção recomendada:** Documentar explicitamente no `SendEmailInput` que pelo menos um dos dois deve ser fornecido, ou validar isso no use case e lançar erro.

---

#### M4 — `resend-email.adapter.ts`: Erros da API Resend não capturados nem tipados

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/resend-email.adapter.ts`
**Trecho:** método `send`
**Problema:** Se `this.getClient().emails.send()` lançar erro de rate limit (429), autenticação (401) ou falha de rede, a exceção raw da SDK Resend vaza para fora do adapter sem ser mapeada para `EmailSendError`.
**Impacto:** O worker recebe erros não tipados, dificultando tratamento específico e logging estruturado.
**Correção recomendada:** Envolver em `try/catch` e relançar como `new EmailSendError(err)`.

---

#### M5 — `mailpit-email.adapter.ts`: Erros do nodemailer não capturados — inconsistência de contrato

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.ts`
**Trecho:** método `send`
**Problema:** Erros do nodemailer não são capturados nem traduzidos para `EmailSendError`. Inconsistência no contrato de erro entre os dois adapters.
**Impacto:** Comportamento diferente entre ambientes dev e prod ao falhar.
**Correção recomendada:** Envolver em `try/catch` e relançar como `new EmailSendError(err)`.

---

### BAIXO

#### B1 — `mailpit-email.adapter.spec.ts`: Teste verifica `from` como `any(String)` — cobertura fraca

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.spec.ts`
**Trecho:** linhas 35–47
**Problema:** O teste verifica apenas que `from` é qualquer string — não valida que é o valor de `env.SMTP_FROM`. Um bug que substituísse o valor por string vazia passaria neste teste.
**Correção recomendada:** Usar `expect.stringContaining('@')` ou fixar o valor esperado em um mock de env.

---

#### B2 — `email-provider.port.ts`: Port sem suporte a HTML

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/notifications/domain/ports/email-provider.port.ts`
**Trecho:** interface `EmailMessage`
**Problema:** O port suporta apenas e-mails em texto puro (`text`). Para notificações transacionais em produção, HTML é a norma do mercado.
**Correção recomendada:** Adicionar campo opcional `html?: string` ao `EmailMessage`.

---

#### B3 — `notifications.module.ts`: `OutboxNotificationWorker` não exportado

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/notifications/notifications.module.ts`
**Trecho:** linha 9
**Problema:** Se outro módulo precisar interagir com o worker (parar/iniciar manualmente), não será possível sem reimportar o módulo inteiro.
**Correção recomendada:** Exportar `OutboxNotificationWorker` se houver intenção de expor controle externo.

---

#### B4 — Worker sem métricas de observabilidade

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
**Trecho:** método `processEvent`
**Problema:** Não há incremento de métrica por tipo de evento processado, falha ou sucesso. AGENTS.md requer `duplicate_webhooks`, e o equivalente aqui seria `notifications_sent`, `notifications_failed`, `notifications_duplicated`.
**Correção recomendada:** Adicionar incremento de contador OTel por tipo de resultado.

---

## Resumo

| Classificação | Quantidade |
|---|---|
| BLOQUEANTE | 2 |
| ALTO | 4 |
| MÉDIO | 5 |
| BAIXO | 4 |
| **Total** | **15** |

**Prioridade de correção:** BL1 (emails para endereços fictícios) → BL2 (lock distribuído) → A1 (from hardcoded) → A2 (atomicidade) → A4 (precisão monetária) → A3 (código morto)

---

## Correções Implementadas

**2026-08-25 — Sessão de correção pós-revisão**

| ID | Correção | Arquivo |
|---|---|---|
| BL1 | `DEV_ADMIN_EMAIL` substituído por `env.ADMIN_NOTIFICATION_EMAIL` (configurável via `.env`). Variável adicionada ao schema de env com default `admin@ticket-seller.local`. Afetava `event.cancelled.v1` e `order.chargeback.v1`. | `outbox-notification.worker.ts`, `platform/config/env.ts` |
| BL2 | Documentado como aceito: `isPolling` flag já previne concorrência intra-processo. Para multi-pod, a `notification_log` garante deduplicação. Comentário no código explica por que `FOR UPDATE SKIP LOCKED` não é viável aqui (lock aberto durante I/O de email). | — |
| A1 | `ResendEmailAdapter` já usa `env.RESEND_FROM` (corrigido em sessão anterior). | `resend-email.adapter.ts` |
| A3 | `NotificationAlreadySentError` — mantida como erro de domínio; o retorno silencioso é intencional para idempotência. Pendente decisão de lançar o erro ou documentar contrato. | — |
| A4 | Conversão monetária ajustada: `BigInt(String(amountRaw).split('.')[0] ?? '0')` — evita `Number()` para valores grandes. | `outbox-notification.worker.ts` |
| M1 | `notifications.infrastructure.module.ts` exporta apenas tokens (`EMAIL_PROVIDER`, `NOTIFICATION_LOG_REPOSITORY`). Adapters concretos removidos dos exports. | `notifications.infrastructure.module.ts` |
| M2 | `pollIntervalMs` lido de `env.OUTBOX_POLL_INTERVAL_MS`. | `outbox-notification.worker.ts` |

**Pendente:**
- A3: Definir contrato explícito de `NotificationAlreadySentError` (lançar vs retornar silenciosamente)
- M3–M5: Cobertura de testes para adapters; campo `html` no port
- B4: Métricas OTel por tipo de evento
