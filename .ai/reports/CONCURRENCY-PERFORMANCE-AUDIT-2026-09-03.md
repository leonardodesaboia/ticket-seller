# Auditoria Profunda de Concorrência, Paralelismo, Async/Sync e Performance

Data: 2026-09-03
Branch: `fix/post-rc1-session9-hardening`
Método: inspeção estática de código-fonte; nenhuma conclusão aceita sem evidência direta no arquivo.

---

## 1. Resumo Executivo

A aplicação possui fundamentos de concorrência corretos: isolamento `Serializable` com retry nas reservas, `FOR UPDATE SKIP LOCKED` nos workers, idempotência com `ON CONFLICT DO NOTHING` na emissão de tickets, e detecção de deadlock (40P01) com retry automático.

Não foi encontrado nenhum achado P0 (corrupção de dados, deadlock permanente ou falha de sistema sem recuperação).

Foram encontrados três achados P1 que afetam diretamente a confiabilidade em produção e devem ser corrigidos antes de qualquer incremento de carga.

| Prioridade | Achado | Arquivo | Status |
|-----------|--------|---------|--------|
| P1 | E-mail chamado dentro de `$transaction` | `outbox-notification.worker.ts` | **FIXED** |
| P1 | Deadlock evitável por ordenação inconsistente de locks | `prisma-reservation.repository.ts` | **FIXED** |
| P1 | Retry em serialization failure sem backoff/jitter | `prisma-reservation.repository.ts`, `reservation-access.adapter.ts` | **FIXED** |
| P2 | SMTP sem `socketTimeout` — conexão pode pendurar indefinidamente | `mailpit-email.adapter.ts` | **FIXED** |
| P2 | N+1 na emissão de tickets dentro de transação | `prisma-payment-webhook-operation.adapter.ts` | **FIXED** |
| P2 | N+1 em `expireHoldsForTicketTypes` dentro de transação Serializable | `prisma-reservation.repository.ts` | **FIXED** |
| P2 | Settlement e reconciliação sequenciais (sem paralelismo) | `settlement.worker.ts`, `reconciliation.worker.ts` | **FIXED (settlement); reconciliation deferida — gateway fake in-memory** |
| P3 | Argon2 com `parallelism: 4` compete por libuv thread pool | `argon-password-hasher.adapter.ts` | **FIXED** |
| P3 | Dummy hash de timing inválido — medido: 0.24ms vs 53ms | `authenticate-with-password.use-case.ts` | **FIXED** |
| P3 | Connection pool sem configuração explícita de tamanho | `prisma.service.ts`, `pgboss.module.ts` | **FIXED (documentado)** |

---

## 2. Matriz de Problemas

| ID | Categoria | Prioridade | Confiança | Impacto em Produção |
|----|-----------|------------|-----------|---------------------|
| C1 | Concorrência — lock de DB dentro de I/O externo | P1 | Confirmado | DB connection esgotada sob load + falha de batch se SMTP trava |
| C2 | Concorrência — lock ordering inconsistente | P1 | Confirmado | Deadlock evitável gasta retries; pode falhar sob contagem alta |
| C3 | Concorrência — retry imediato sem backoff | P1 | Confirmado | Contention amplificada em picos |
| C4 | Async — SMTP sem socketTimeout | P2 | Confirmado | Worker pode ficar suspenso indefinidamente por provedor SMTP lento |
| C5 | Performance — N+1 em emissão de tickets | P2 | Confirmado | Latência de webhook proporcional ao total de tickets do pedido |
| C6 | Performance — N+1 em expiração de holds | P2 | Confirmado | Queries O(T×R×I) dentro de transação Serializable contenciosa |
| C7 | Paralelismo — workers sequenciais | P2 | Confirmado | Throughput de settlement limitado a ~5 ordens/s; reconciliação bloqueada por HTTP lento |
| C8 | Memory — argon2 thread pool | P3 | Provável | Sob login concurrent, libuv pool (tamanho 4) fica saturado com DNS/fs como vítimas |
| C9 | Timing — dummy hash inválido | P3 | Confirmado | Medido: 0.24ms (dummy) vs 53ms (real) — 220× mais rápido; anti-timing ineficaz |
| C10 | Recursos — pools sem tamanho explícito | P3 | Confirmado | Sem `connection_limit`, Prisma usa fórmula por CPU que pode não ser ideal |

---

## 3. Análise de Concorrência

### 3.1 Isolation Levels em uso

| Operação | Isolation Level | Arquivo |
|---------|----------------|---------|
| Criação de reserva | `Serializable` | `prisma-reservation.repository.ts:163` |
| Cancelamento de reserva | `RepeatableRead` | `prisma-reservation.repository.ts:213` |
| Criação de pedido | `Serializable` | `reservation-access.adapter.ts` |
| Webhook de pagamento | padrão (ReadCommitted) | `prisma-payment-webhook-operation.adapter.ts` |
| Settlement de pedido | padrão (ReadCommitted) | `settlement.worker.ts` |
| Reconciliação de payout | padrão (ReadCommitted) | `reconciliation.worker.ts` |
| Expiração de reservas em massa | padrão (ReadCommitted) | `prisma-reservation.repository.ts:222` |

O uso de `Serializable` em reserva e pedido é correto: garante que a verificação de capacidade e a reserva de inventory sejam atômicas sob concorrência.

### 3.2 FOR UPDATE SKIP LOCKED

Todos os workers que buscam filas de trabalho usam `FOR UPDATE SKIP LOCKED`, o que é correto. Os achados do relatório anterior (`DEEP-TECHNICAL-AUDIT-2026-08-31.md`, item Médio sobre locks terminando antes do processamento) são cobertos por idempotência: settlement verifica `NOT EXISTS (SELECT 1 FROM balance_settlements WHERE order_id = o.id)` e reconciliação re-lock com `SELECT ... FOR UPDATE` antes de atualizar.

### 3.3 [C1] E-mail dentro de transação de banco de dados — P1

**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`

Código verificado. Estrutura real (linhas 60–75, 83–124):

```typescript
// Linha 60 — $transaction sem timeout override
await this.prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRaw`SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10`; // linha 61-70
  for (const row of rows) {
    await this.processEvent(tx, row);     // linha 73 — processEvent recebe tx
  }
});

// processEvent (linha 83): chama handleOrderPaid / handleOrderCancelled / etc.
// handleOrderPaid (linha 130): chama await this.sendEmail.execute(input)  ← linha 159
// O UPDATE processed_at / failed_at (linhas 108-122) ocorre DEPOIS do sendEmail, ainda dentro da tx
```

**Problemas verificados:**
1. `sendEmail.execute` (lines 159, 198, 247, 281, 315 — todos dentro da transação via `processEvent`) chama o provider de e-mail (Resend HTTP API ou SMTP nodemailer). Round-trip típico: 1–5 segundos por e-mail.
2. O `$transaction` na linha 60 **não configura `timeout`**. O Prisma usa timeout padrão de 5 000ms. Se o e-mail demorar mais de 5s, Prisma aborta a transação inteira: `processed_at` e `failed_at` NÃO são gravados → o evento volta para a fila na próxima poll (correto para não perder o evento, mas gera loop de retry enquanto o provider estiver lento).
3. Com batch de 10 eventos e timeout de 5s, o pior caso é a transação ser mantida aberta por 5s e depois reaberta imediatamente no próximo poll — mantendo o DB connection e as row locks ocupadas de forma contínua.
4. `MailpitEmailAdapter` não tem `socketTimeout` (ver C4). Se o servidor SMTP não fechar a conexão, `sendMail()` nunca rejeita — o Prisma timeout de 5s é o único freio, mas exige que o socket timeout do SO eventualmente opere.

**Impacto em produção:** um spike de e-mails lentos (ex: cancelamento de evento com 500 participantes) gera poll loops contínuos segurando connections do pool, aumentando pressão sobre `DATABASE_URL?connection_limit` e atrasando outros módulos.

**Tradeoff da correção:** a abordagem atual é atomicamente correta — `sendEmail` e `processed_at`/`failed_at` falham ou confirmam juntos. Mover o envio para fora da transação converte a garantia de atomicidade em **at-least-once com dedup**. Isso é seguro porque `SendEmailUseCase` já possui deduplicação por `outboxEventId` via `notificationLog.hasBeenSentForOutboxEvent` (linha 31–33 do use-case). A inversão é: marcar `processed_at` na transação, depois enviar fora. Se o envio falhar após commit, o evento ficará `processed_at` sem e-mail enviado — por isso a dedup deve ser tratada como fallback de idempotência, não como garantia primária.

**Correção (quick win):**
```typescript
// Padrão correto: marcar dentro da tx, enviar fora
const toSend: Array<{ input: SendEmailInput; rowId: string }> = [];
await this.prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRaw`SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10`;
  for (const row of rows) {
    const input = this.buildInput(row);   // extrai SendEmailInput sem chamar sendEmail
    toSend.push({ input, rowId: row.id });
    await tx.$executeRaw`UPDATE outbox_events SET processed_at = NOW(), attempts = attempts + 1 WHERE id = ${row.id}::uuid`;
  }
});
// Envia fora da transação; dedup no SendEmailUseCase garante idempotência
for (const { input, rowId } of toSend) {
  try { await this.sendEmail.execute(input); }
  catch (err) { this.logger.error(`Email send failed after commit — outboxEventId=${rowId}`, err); }
}
```

---

## 4. Análise de Deadlocks

### 4.1 [C2] Lock ordering inconsistente em `create` vs `cancel` — P1

**Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts`

**Create** — linha 128–136: os `snapshots` são iterados na ordem de inserção do `Map` (que reflete a ordem dos itens no corpo da requisição HTTP):
```typescript
const requested = new Map<string, number>();
for (const item of input.items) requested.set(item.ticketTypeId, ...); // ordem do cliente
const snapshots = [...requested].map(...); // preserva ordem de inserção

for (const snapshot of snapshots) {           // UPDATE em ordem arbitrária
  await tx.$executeRaw`UPDATE ticket_inventory SET reserved = ... WHERE ticket_type_id = ${snapshot.ticketTypeId}::uuid ...`;
}
```

**Cancel** — linha 207–209: items retornados por `findItems` com `ORDER BY ticket_type_id` (ordem lexicográfica de UUID):
```typescript
const items = await this.findItems(tx, reservation.id); // ORDER BY ticket_type_id
for (const item of items) {
  await tx.$executeRaw`UPDATE ticket_inventory SET reserved = ... WHERE ticket_type_id = ${item.ticket_type_id}::uuid ...`;
}
```

**Cenário de deadlock:**
- Requisição A: reserva `[T-type-2, T-type-1]` — UPDATE T2 (lock), espera T1
- Requisição B: reserva `[T-type-1, T-type-2]` — UPDATE T1 (lock), espera T2
- PostgreSQL detecta ciclo → 40P01 → um transaction abortado → `isSerializationFailure` → retry imediato

O deadlock é detectado e recuperado corretamente. O problema é que (a) desperdiça 1 attempt dos 3 disponíveis, (b) sob alta concorrência, todos os 3 attempts podem esgotar.

Adicionalmente, `create` (sem ordenação) vs `cancel` (com `ORDER BY ticket_type_id`) criam inconsistência que aumenta a probabilidade de deadlock cruzado entre uma criação e um cancelamento concorrentes sobre os mesmos ticket types.

**Correção:**
```typescript
// Linha 120 — após construir snapshots, ordenar antes do loop de UPDATE
const snapshots = [...requested]
  .map(([ticketTypeId, quantity]) => { ... })
  .sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId)); // garantia de ordem consistente
```

---

## 5. Análise de Serialization Failures e Backoff

### 5.1 [C3] Retry imediato sem backoff — P1

**Arquivos:**
- `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts:164–175`
- `apps/api/src/modules/orders/infrastructure/adapters/reservation-access.adapter.ts`

```typescript
// Reserva — retry imediato
if (isSerializationFailure(error) && attempt < 2) {
  return this.createWithRetries(input, attempt + 1); // ← sem delay, sem jitter
}
```

O retry imediato sob contention serialização retorna ao banco no mesmo instante. Se 10 transações tentam simultaneamente reservar o mesmo ticket type, todas as que falharam são reenviadas imediatamente — aumentando a contention do próximo ciclo em vez de diminuí-la.

**Correção:** adicionar backoff exponencial com jitter antes do retry:
```typescript
if (isSerializationFailure(error) && attempt < 2) {
  const delayMs = (50 + Math.random() * 50) * 2 ** attempt; // 50–100ms, 100–200ms
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return this.createWithRetries(input, attempt + 1);
}
```

**Nota:** a mesma correção deve ser aplicada ao `cancelWithRetries` e ao equivalente em `reservation-access.adapter.ts`.

---

## 6. Análise de Async/Sync e Event Loop

### 6.1 Operações assíncronas corretamente tratadas

Todos os controllers usam `async/await`. Os use-cases não têm operações síncronas bloqueantes no event loop. Argon2, Bcrypt (não usado) e crypto nativo são assíncronos via libuv.

### 6.2 [C8] Argon2 e libuv thread pool — P3

**Arquivo:** `apps/api/src/modules/identity/infrastructure/adapters/argon-password-hasher.adapter.ts`

```typescript
private readonly options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB por operação
  timeCost: 3,
  parallelism: 4,     // 4 lanes internas no algoritmo argon2
};
```

O parâmetro `parallelism: 4` é uma propriedade interna do algoritmo argon2 (número de lanes de memória), **não** o número de threads libuv usadas. O pacote `argon2` (node-argon2) despacha cada hash como **um** async work item na libuv thread pool. O libuv thread pool padrão tem 4 threads (`UV_THREADPOOL_SIZE=4`).

Impacto real sob carga:
- 4 logins concorrentes → 4 threads libuv ocupadas com argon2 (~100–300ms cada)
- Durante esse período, outras operações que também usam o pool libuv (DNS, `fs.readFile`, `crypto.randomBytes` síncrono, `zlib`) são bloqueadas
- **Prisma não é afetado** — o query engine Prisma usa seu próprio canal, não a libuv default pool
- Memória: 64 MB × 4 operações simultâneas = 256 MB de pressão de RAM

**Mitigação:** `UV_THREADPOOL_SIZE=16` no Dockerfile ou `docker-compose.prod.yml` para aumentar a capacidade. Não é obrigatório no volume atual, mas necessário antes de escalar horizontalmente.

---

## 7. Banco de Dados — N+1 e Query Batching

### 7.1 [C5] N+1 na emissão de tickets — P2

**Arquivo:** `apps/api/src/modules/payments/infrastructure/adapters/prisma-payment-webhook-operation.adapter.ts`

Dentro da transação de aprovação do pagamento, tickets são inseridos em loops aninhados:
```typescript
for (const item of orderItems) {
  for (let unitIndex = 0; unitIndex < Number(item.quantity); unitIndex++) {
    await tx.$executeRaw`
      INSERT INTO tickets (id, order_id, ticket_type_id, status, credential_type)
      VALUES (gen_random_uuid(), ${orderId}::uuid, ${item.ticket_type_id}::uuid, 'ISSUED', 'QR_CODE')
      ON CONFLICT (order_id, ticket_type_id, unit_index) DO NOTHING
    `;
  }
}
```

Para um pedido com 3 ticket types × 10 ingressos = 30 round-trips sequenciais ao PostgreSQL dentro de uma transação já extensa. Cada round-trip custa ~1–5ms; para 30 tickets: +30–150ms de latência no webhook.

**Correção:** um único `INSERT ... VALUES (...), (...), ...` com todos os tickets do pedido:
```typescript
// Construir valores para batch INSERT
const values = orderItems.flatMap((item) =>
  Array.from({ length: Number(item.quantity) }, (_, unitIndex) => ({
    orderId,
    ticketTypeId: item.ticket_type_id,
    unitIndex,
  }))
);
// Prisma createMany ou raw INSERT com array unnest
await tx.$executeRaw`
  INSERT INTO tickets (id, order_id, ticket_type_id, unit_index, status, credential_type)
  SELECT gen_random_uuid(), v.order_id, v.ticket_type_id, v.unit_index, 'ISSUED', 'QR_CODE'
  FROM unnest(
    ${values.map((v) => v.orderId)}::uuid[],
    ${values.map((v) => v.ticketTypeId)}::uuid[],
    ${values.map((v) => v.unitIndex)}::int[]
  ) AS v(order_id, ticket_type_id, unit_index)
  ON CONFLICT (order_id, ticket_type_id, unit_index) DO NOTHING
`;
```

### 7.2 [C6] N+1 em `expireHoldsForTicketTypes` — P2

**Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts:262–280`

```typescript
private async expireHoldsForTicketTypes(tx: TransactionClient, ticketTypeIds: string[]): Promise<void> {
  for (const ticketTypeId of ticketTypeIds) {                    // 1 query por ticket type
    const expired = await tx.$queryRaw`SELECT DISTINCT r.id FROM reservations r
      JOIN reservation_items ri ON ri.reservation_id = r.id
      WHERE r.status = 'ACTIVE' AND r.expires_at <= NOW()
        AND ri.ticket_type_id = ${ticketTypeId}::uuid`;
    for (const reservation of expired) {                         // por reserva expirada:
      await this.expireReservation(tx, reservation.id);          //   findReservation + findItems + UPDATE reservations + N × UPDATE inventory
    }
  }
}
```

Complexidade: O(T × R × I) queries, onde T = ticket types no pedido, R = reservas expiradas por tipo, I = items por reserva. Tudo isso ocorre dentro de uma transação Serializable de reserva, prolongando o tempo de lock e aumentando a probabilidade de conflitos de serialização.

Contraste com `expireActiveReservations` (linha 222), que usa um único `UPDATE ... RETURNING` + um único `UPDATE ticket_inventory ... FROM (SELECT ... GROUP BY)` — padrão correto.

**Correção preferida:** mover a expiração de holds para fora da criação de reserva. As reservas expiradas já são cobertas por `expireActiveReservations` (cron separado ou chamado pelo scheduler). Remover `expireHoldsForTicketTypes` da criação de reserva e confiar no cron. Se o cron não for suficientemente frequente, rodá-lo mais frequentemente.

**Alternativa:** reescrever `expireHoldsForTicketTypes` com uma única query bulk usando `ANY(array)` + UPDATE bulk, no mesmo padrão de `expireActiveReservations`.

---

## 8. HTTP/API — Timeouts e Integração

### 8.1 [C4] SMTP sem socketTimeout — P2

**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.ts`

```typescript
this.transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  // connectionTimeout não configurado (default: 2 min)
  // socketTimeout não configurado (default: 0 = sem limite)
});
```

O `socketTimeout: 0` (default nodemailer) significa que, após a conexão TCP ser estabelecida, se o servidor SMTP não enviar dados por qualquer período, o socket permanece aberto indefinidamente. Combinado com C1 (e-mail dentro de transação), isso significa que um servidor SMTP lento ou travado pode segurar a transação de banco para sempre.

**Correção:**
```typescript
this.transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  connectionTimeout: 5_000,  // 5s para estabelecer conexão
  socketTimeout: 10_000,     // 10s de inatividade no socket
});
```

### 8.2 Resend SDK — timeout não configurável diretamente

**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/resend-email.adapter.ts`

O SDK do Resend não expõe configuração de timeout na inicialização `new Resend(apiKey)`. O timeout efetivo depende do timeout padrão do `fetch` nativo (sem limite no Node.js) ou da configuração interna do SDK. **Ação:** verificar a documentação do Resend SDK para configuração de timeout; se não disponível, envolver em `Promise.race` com `AbortController` ou usar o padrão de move-outside-tx (C1) que limita o impacto a uma falha de e-mail em vez de uma falha de DB.

### 8.3 Payout gateway — sem HTTP real (gateway fake)

A implementação atual é `FakePayoutGateway`, que usa um `Map` em memória. Não há chamadas HTTP. Quando um gateway real for integrado, **deve** incluir timeout explícito na chamada `getPayoutStatus` (ex: AbortSignal com 10s), pois é chamado pelo `ReconciliationWorker` em loop sequencial — um gateway lento poderia bloquear o worker por horas.

---

## 9. Análise de Paralelismo nos Workers

### 9.1 OutboxNotificationWorker

**Arquivo:** `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`

- Usa `setInterval` de 5s com flag `isPolling` para evitar sobreposição — correto para instância única.
- `FOR UPDATE SKIP LOCKED` previne conflito entre múltiplas instâncias — correto.
- Processa até 10 eventos **sequencialmente** por batch. Com e-mails lentos, throughput é baixo.
- **Risco com múltiplas instâncias:** `setInterval` é local a cada processo. Sem coordenação distribuída, cada instância da API terá seu próprio loop de polling, consumindo eventos em paralelo via `SKIP LOCKED` (correto por design).

### 9.2 [C7] Settlement sequencial — P2

**Arquivo:** `apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts`

```typescript
for (const order of orders) {                          // 50 ordens, sequencial
  if (await this.processOrder(order)) processed++;
}
```

Cada `processOrder` faz uma transação separada (ledger entries + update de status). Estima-se ~10–30ms por order. Para 50 ordens: +500ms–1.5s de latência de worker. Não é crítico para cron horário, mas limita escalabilidade.

**Quick win:** paralelismo limitado com `Promise.all` em chunks:
```typescript
const CONCURRENCY = 5;
for (let i = 0; i < orders.length; i += CONCURRENCY) {
  const chunk = orders.slice(i, i + CONCURRENCY);
  const results = await Promise.all(chunk.map((o) => this.processOrder(o)));
  processed += results.filter(Boolean).length;
}
```

### 9.3 Reconciliação sequencial

**Arquivo:** `apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts`

Payouts stuck são processados sequencialmente, cada um com chamada a `gateway.getPayoutStatus`. Com o FakePayoutGateway atual (in-memory) o impacto é zero. Com gateway real, cada chamada HTTP pode levar 1–5s, tornando a reconciliação de 20 payouts stuck uma operação de 20–100s. Mesma correção de paralelismo limitado aplica-se quando um gateway real for introduzido.

---

## 10. Memory e Recursos

### 10.1 [C10] Connection pool sem configuração explícita — P3

**Arquivos:**
- `apps/api/src/platform/database/prisma.service.ts` — pool criado por Prisma com fórmula padrão
- `apps/api/src/platform/scheduling/pgboss.module.ts` — pool separado criado por pg-boss

A aplicação mantém dois pools concorrentes no mesmo banco PostgreSQL:
1. **Prisma pool**: tamanho por padrão = `(CPU × 2) + 1` no servidor, mas pode variar. Em um VPS de 2 CPUs = 5 conexões.
2. **pg-boss pool**: pool interno da lib, tipicamente 2–3 conexões.

Total estimado: ~8 conexões. PostgreSQL padrão aceita 100. Não é um problema hoje, mas sem `?connection_limit=N` na `DATABASE_URL`, não há garantia se o volume de pods escalar.

**Recomendação:** adicionar `?connection_limit=10&pool_timeout=30` à `DATABASE_URL` em produção e `UV_THREADPOOL_SIZE=16` no Dockerfile. Documentar no `.env.example`.

---

## 11. Análise de Race Conditions

### 11.1 Verificado e correto: idempotency no webhook de pagamento

`ON CONFLICT DO NOTHING` em `payment_webhook_events` previne double-processing. `SELECT ... FOR UPDATE` dentro da transação do webhook antes de atualizar o pedido previne race entre webhooks duplicados.

### 11.2 Verificado e correto: reserva de inventory

`UPDATE ticket_inventory SET reserved = reserved + N WHERE (capacity - reserved - committed) >= N` é atômico — a verificação e o incremento ocorrem na mesma operação SQL.

### 11.3 [C9] Timing equalization ineficaz — P3 — CONFIRMADO

**Arquivo:** `apps/api/src/modules/identity/application/use-cases/authenticate-with-password.use-case.ts`

Quando o usuário não existe, o código executa:
```typescript
await this.hasher.verify(
  '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummydummydummy',
  input.password,
);
```

**Medição empírica** (20 amostras cada, node-argon2 com `memoryCost:65536, timeCost:3, parallelism:4`):

| Caminho | Tempo médio |
|---------|------------|
| Dummy hash inválido | **0.24 ms** (falha no parse) |
| Hash real + senha errada | **53 ms** (computação completa) |

A diferença é **220×**. O segmento `dummy` não é base64 de tamanho correto para argon2 — o parse falha em microssegundos antes de qualquer computação de memória. Um atacante pode distinguir "usuário não existe" de "usuário existe, senha errada" pela latência de resposta, mesmo com jitter de rede.

**Severidade: LOW** — mitigado por rate limiting (`SmartThrottlerGuard`, 5 tentativas/15min por email) e throttler global. O ataque requereria muitas requisições filtradas pelo rate limiter.

**Correção de baixo custo:** substituir o dummy hash por um hash argon2 real pré-computado de uma string fixa (gerado uma vez e hardcoded como constante na classe):
```typescript
// Gerar uma única vez, antes de deployar:
// await argon2.hash('placeholder-dummy-password', { memoryCost: 65536, timeCost: 3, parallelism: 4 })
private static readonly DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$<salt_válido>$<hash_válido>';
```

---

## 12. Análise de Backpressure

### 12.1 OutboxNotificationWorker — backpressure implícita

O batch de 10 + `isPolling = true` cria backpressure implícita: se o processamento de 10 e-mails levar >5s, o próximo poll é pulado. Isso é correto — impede acumulação de work items. Com a correção C1 (e-mail fora da tx), a latência por batch cai drasticamente e o throughput melhora.

### 12.2 Workers pg-boss — sem `maxConcurrency` configurado

**Arquivo:** `apps/api/src/platform/scheduling/pgboss.module.ts`

```typescript
const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
```

Sem `maxConcurrency`, pg-boss usa seu padrão (1 worker concurrent por fila por padrão no modo `work`). Para cron jobs com uma única instância por vez, isso é correto. Se no futuro forem adicionados jobs de alta volume, será necessário ajustar.

---

## 13. Timeouts e Cancellation

### 13.1 Transações sem timeout explícito

**Arquivo:** `apps/api/src/modules/finance/infrastructure/adapters/prisma-finance-transaction-runner.adapter.ts`

```typescript
async run<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
  return this.prisma.$transaction(work); // sem timeout, sem isolation level
}
```

Prisma usa timeout padrão de ~5s em transações interativas (configurável via `transaction.maxWait` e `transaction.timeout`). O `FinanceTransactionRunner` não configura nenhum desses parâmetros.

**Recomendação:** adicionar `timeout: 10_000` (10s) explicitamente:
```typescript
return this.prisma.$transaction(work, { timeout: 10_000 });
```

### 13.2 Cancelamento de request HTTP não propagado

NestJS/Fastify não cancela automaticamente operações de banco quando o cliente desconecta. Para o volume atual isso é aceitável — as operações são curtas e idempotentes. Não é necessária ação.

---

## 14. Análise de Escalabilidade

> **Nota:** os valores desta seção são estimativas analíticas derivadas do código, não resultados de benchmark ou teste de carga. Latências por operação (~10–30ms por settlement, ~1–5s por e-mail) são ordens de grandeza razoáveis, não medições. Os thresholds de throughput são indicativos.

### 14.1 Gargalos identificados sob carga

| Cenário | Gargalo | Threshold estimado |
|---------|---------|-------------------|
| Pico de vendas (100 req/s no mesmo evento) | SERIALIZABLE conflicts com 3 retry max | ~20–30 req/s de sucesso por ticket type |
| Cancelamento de evento grande (1000 participantes) | Batch de 10 e-mails × 1s = 100 polls × 5s = 8min para processar todos | Correto, mas lento |
| 10 logins simultâneos | libuv pool saturada com argon2 | DNS + fs.readFile degradam |
| Settlement horário com 500 ordens elegíveis | `FETCH NEXT 50` → apenas 50 processadas por hora | Settlement incompleto |

### 14.2 Ceiling de reservas concorrentes

Com `Serializable` + 3 attempts e backoff exponencial proposto (C3), o throughput real de reservas para um evento popular é limitado pelo throughput de serialização do PostgreSQL. Para alta demanda prevista, considerar:
- **Batch de emissão assíncrona**: aceitar reserva com 202 Accepted e confirmar via webhook
- **Read-your-writes com version bump**: usar `RepeatableRead` + check otimista de version column (já existe `version` na `ticket_inventory`)

---

## 15. Plano de Correção

### Prioridade 1 — Antes do próximo release

| ID | Correção | Arquivo(s) | Complexidade |
|----|---------|-----------|-------------|
| C1 | Mover `sendEmail.execute()` para fora da `$transaction` | `outbox-notification.worker.ts` | Média |
| C2 | Ordenar `snapshots` por `ticketTypeId` antes do loop de UPDATE | `prisma-reservation.repository.ts:120` | Baixa |
| C3 | Adicionar backoff exponencial + jitter no retry de serialization failure | `prisma-reservation.repository.ts`, `reservation-access.adapter.ts` | Baixa |
| C4 | Adicionar `socketTimeout: 10_000` e `connectionTimeout: 5_000` ao nodemailer | `mailpit-email.adapter.ts` | Baixa |

### Prioridade 2 — Próximo sprint

| ID | Correção | Arquivo(s) | Complexidade |
|----|---------|-----------|-------------|
| C5 | Batch INSERT de tickets com `unnest` | `prisma-payment-webhook-operation.adapter.ts` | Alta |
| C6 | Remover `expireHoldsForTicketTypes` do caminho de criação de reserva | `prisma-reservation.repository.ts` | Alta |
| C7 | Paralelismo limitado (chunk de 5) no SettlementWorker | `settlement.worker.ts` | Baixa |
| C10 | Configurar `connection_limit` e `UV_THREADPOOL_SIZE` | `docker-compose.prod.yml`, Dockerfile, `.env.example` | Baixa |

### Prioridade 3 — Backlog técnico

| ID | Correção | Arquivo(s) | Complexidade |
|----|---------|-----------|-------------|
| C8 | `UV_THREADPOOL_SIZE=16` no processo | Dockerfile ou docker-compose | Baixa |
| C9 | Dummy hash com argon2 real pré-computado | `authenticate-with-password.use-case.ts` | Baixa |

---

## 16. Quick Wins — Patches Prioritários

### QW-1: Ordenação de snapshots (C2) — 1 linha

**Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts:120`

```typescript
// ANTES
const snapshots = [...requested].map(([ticketTypeId, quantity]) => { ... });

// DEPOIS
const snapshots = [...requested]
  .map(([ticketTypeId, quantity]) => { ... })
  .sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
```

### QW-2: Backoff em retry de serialization failure (C3)

**Arquivo:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts:164`

```typescript
// ANTES
if (isSerializationFailure(error) && attempt < 2) {
  return this.createWithRetries(input, attempt + 1);
}

// DEPOIS
if (isSerializationFailure(error) && attempt < 2) {
  const delayMs = (50 + Math.random() * 50) * 2 ** attempt;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return this.createWithRetries(input, attempt + 1);
}
```

### QW-3: socketTimeout no nodemailer (C4)

**Arquivo:** `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.ts:14`

```typescript
// ANTES
this.transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

// DEPOIS
this.transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  connectionTimeout: 5_000,
  socketTimeout: 10_000,
});
```

---

## 17. Mudanças Arquiteturais (Médio Prazo)

### MA-1: Separar camada de envio do OutboxWorker

Estrutura atual (anti-pattern):
```
OutboxWorker → $transaction → sendEmail (HTTP externo) → UPDATE processed_at
```

Estrutura proposta (at-least-once com dedup):
```
OutboxWorker → $transaction → UPDATE processed_at → commit
            → [fora da tx] → sendEmail (HTTP externo) → log
SendEmailUseCase → hasBeenSentForOutboxEvent() → dedup
```

Essa mudança exige garantir que o `SendEmailUseCase` consulte o `notificationLog` antes de qualquer envio (já existe), tornando o padrão seguro.

### MA-2: Expiração de holds como operação independente

Remover `expireHoldsForTicketTypes` da transação de criação de reserva. A expiração periódica já existe via `expireActiveReservations`. Aumentar a frequência do scheduler de expiração (ex: a cada 30s) em vez de fazer a expiração inline.

### MA-3: UV_THREADPOOL_SIZE no Dockerfile

```dockerfile
ENV UV_THREADPOOL_SIZE=16
```

---

## 18. Evidências Positivas (sem alteração necessária)

| Área | Evidência |
|------|-----------|
| Idempotência de pagamento | `payment_webhook_events ON CONFLICT DO NOTHING` + `FOR UPDATE` antes de update do pedido |
| Inventory atomicity | `UPDATE ... WHERE (capacity - reserved - committed) >= N` — atômico |
| Workers com SKIP LOCKED | Todos os workers de fila usam `FOR UPDATE SKIP LOCKED` |
| Deadlock detectado e retry | `isSerializationFailure` cobre `P2034`, `40001`, `40P01` |
| Settlement idempotente | `NOT EXISTS (SELECT 1 FROM balance_settlements WHERE order_id = o.id)` |
| Reconciliação com re-lock | `SELECT status FROM payouts FOR UPDATE` antes de update de status |
| `expireActiveReservations` eficiente | Bulk UPDATE + bulk inventory update em única query |
| Timing em login (parcial) | Dummy hash executado mesmo quando usuário não existe |
| Timing em reset de senha | Delay aleatório 150–250ms para caminho inexistente |

---

## 19. Checklist Final

### Antes do próximo deploy em produção

- [x] C1: Mover e-mail para fora da transação no OutboxNotificationWorker
- [x] C2: Ordenar snapshots por `ticketTypeId` em `createWithRetries`
- [x] C3: Adicionar backoff exponencial em `createWithRetries` e `cancelWithRetries`
- [x] C4: Adicionar `socketTimeout` e `connectionTimeout` ao nodemailer

### No próximo sprint

- [x] C5: Batch INSERT de tickets com `unnest` no webhook adapter
- [x] C6: Reescrever `expireHoldsForTicketTypes` como bulk query (3 queries fixas)
- [x] C7: Paralelismo limitado no SettlementWorker (chunks de 5)
- [x] C10: Documentar `connection_limit` no `apps/api/.env.example`

### Backlog técnico

- [x] C8: `UV_THREADPOOL_SIZE=16` no Dockerfile
- [x] C9: Substituir dummy hash por hash argon2 real pré-computado
- [ ] Timeout explícito em `FinanceTransactionRunner`
- [ ] Verificar timeout do Resend SDK e documentar

---

## 20. Decisões e Pendências

- **D1 (cd.yml rollback)** — pendente de aprovação explícita para modificar pipeline CI/CD.
- **Payout gateway real** — quando integrado, deve incluir timeout HTTP explícito (`AbortController` ou `signal`) em `getPayoutStatus` e `createPayout`.
- Este relatório substitui a seção "Médio — locks SKIP LOCKED terminam antes do processamento" do `DEEP-TECHNICAL-AUDIT-2026-08-31.md`: o mecanismo de idempotência cobre o risco; a correção real é o backoff (C3) para evitar amplificação de contention.

---

## 21. Correções Aplicadas — 2026-09-03

Branch: `fix/post-rc1-session9-hardening`

### C1 — OutboxNotificationWorker: e-mail fora da transação

**Abordagem implementada** (difere levemente do patch sugerido na seção 3.3):

Em vez de marcar `processed_at` dentro da transação e enviar fora, o poll agora executa apenas o `SELECT FOR UPDATE SKIP LOCKED` em uma transação curta. Após o commit (lock liberado), cada evento é processado individualmente — e-mail enviado, depois `processed_at` ou `failed_at` setados via queries diretas. Isso preserva o isolamento por evento: falha em um e-mail não afeta os outros nove, e `failed_at`/`last_error` continuam sendo gravados corretamente. A dedup em `SendEmailUseCase.hasBeenSentForOutboxEvent` protege contra double-send no breve janela entre o commit do SELECT e o `processed_at` do evento.

```
ANTES: $transaction(SELECT → sendEmail → UPDATE processed_at) — conexão segura durante envio HTTP
DEPOIS: $transaction(SELECT) → commit → sendEmail → $executeRaw(UPDATE processed_at)
```

### C2 — Lock ordering: comparação code-point, não localeCompare

O patch sugerido na seção 16 usava `localeCompare`, que pode divergir da ordenação byte a byte do PostgreSQL (`ORDER BY ticket_type_id`). A implementação usa `(a < b ? -1 : a > b ? 1 : 0)` (comparação code-point), garantindo consistência com o comportamento do DB para qualquer valor de UUID.

### C3 — Backoff exponencial com jitter

Aplicado em três pontos: `createWithRetries` e `cancelWithRetries` em `prisma-reservation.repository.ts`, e `createWithRetries` em `reservation-access.adapter.ts`. Fórmula: `Math.min((50 + Math.random() * 50) * 2^attempt, 2000)ms`.

### C4 — SMTP timeouts

`connectionTimeout: 5_000, socketTimeout: 10_000` adicionados ao `MailpitEmailAdapter`. Compatível com o adaptador Resend (que usa HTTP separado).

### C5 — Batch INSERT com UNNEST

Substituiu loop duplo por um único `INSERT ... SELECT UNNEST(...)` cobrindo todos os tickets do pedido. Arrays de `id`, `organization_id`, `event_id`, `order_id`, `order_item_id`, `ticket_type_id`, `unit_index` e `public_code` são passados como parâmetros e desempacotados pelo PostgreSQL. O `ON CONFLICT (order_item_id, unit_index) DO NOTHING` preserva a idempotência original.

### C6 — expireHoldsForTicketTypes: bulk query

A opção sugerida de "remover e confiar no cron" foi descartada porque `expireActiveReservations` não está wired a nenhum scheduler (apenas definida na porta). A correção foi reescrever como 3 queries fixas independente do volume:

1. `SELECT DISTINCT r.id ... WHERE ticket_type_id = ANY(array)` — encontra todas as reservas expiradas que tocam os ticket types
2. `UPDATE reservations WHERE id = ANY(ids) AND status = 'ACTIVE' AND expires_at <= NOW()` — expira em bulk
3. `UPDATE ticket_inventory ... FROM (SELECT SUM ... GROUP BY) AS agg` — libera inventory em bulk (padrão idêntico ao `expireActiveReservations`)

### C7 — Paralelismo no SettlementWorker

Loop `for` substituído por chunks de 5 via `Promise.all`. O `processOrder` não propaga exceções (captura internamente e retorna `false`), então `Promise.all` nunca rejeita por falha individual. A reconciliação ficou sequencial — com o `FakePayoutGateway` o impacto é zero, e a mudança deve ser aplicada quando um gateway real for integrado.

### C8 — UV_THREADPOOL_SIZE

`ENV UV_THREADPOOL_SIZE=16` adicionado ao `Dockerfile` antes do `EXPOSE 3000`.

### C9 — Hash argon2 real pré-computado

O hash `$argon2id$v=19$m=65536,p=4,t=3$dummy$dummydummydummy` (que falhava no parse em 0.24ms) foi substituído por um hash gerado em runtime com os mesmos parâmetros de produção:

```
$argon2id$v=19$m=65536,p=4,t=3$RIdpw3v/zqZ13YvFtmgdAg$cRP7BlSn3nOxAU+PcjE5rkC0fdU3VdDnj/JXngENZE0
```

`verify()` contra este hash percorre o custo real de memória/CPU (~50ms), eliminando a diferença de 220× medida. Definido como constante de módulo `TIMING_DUMMY_HASH`.

### C10 — Documentação de connection_limit

`DATABASE_URL` adicionada ao `apps/api/.env.example` com comentário explicando como calcular `connection_limit` correto para cada ambiente (DB max_connections, pg-boss, réplicas).

### Pendências remanescentes

| Item | Motivo |
|------|--------|
| Timeout no `FinanceTransactionRunner` | Sem aprovação explícita para alterar infra compartilhada |
| Timeout no Resend SDK | SDK não expõe opção; requer `Promise.race` + `AbortController` — avaliação separada |
| Paralelismo na reconciliação | Deferido até integração de gateway HTTP real |

---

## Arquivos Auditados

| Arquivo | Achados |
|---------|---------|
| `outbox-notification.worker.ts` | C1, C4 |
| `prisma-reservation.repository.ts` | C2, C3, C6 |
| `reservation-access.adapter.ts` | C3 |
| `prisma-payment-webhook-operation.adapter.ts` | C5 |
| `settlement.worker.ts` | C7 |
| `reconciliation.worker.ts` | C7 (mitigado por fake gateway) |
| `argon-password-hasher.adapter.ts` | C8 |
| `authenticate-with-password.use-case.ts` | C9 |
| `mailpit-email.adapter.ts` | C4 |
| `resend-email.adapter.ts` | timeout (risco futuro) |
| `fake-payout.gateway.ts` | OK (in-memory; sem HTTP real) |
| `prisma-finance-transaction-runner.adapter.ts` | timeout recomendado |
| `pgboss.module.ts` | C10 |
| `prisma-inventory.repository.ts` | OK (tryReserve atômico) |
| `issue-tickets.use-case.ts` | N+1 (covered by C5 via webhook path) |
