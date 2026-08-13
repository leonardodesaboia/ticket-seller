# Módulo: Check-in

## Responsabilidade

Validar a entrada de participantes e registrar a utilização de ingressos.

## Não é responsabilidade

- emitir ingresso;
- transferir ingresso;
- receber pagamento;
- controlar estoque de venda;
- gerar repasse.

---

## Implementado (MVP)

### Tabela `check_ins`

Migration `20260812000015_check_ins`.

- `id UUID` — gerado pela aplicação.
- `organization_id`, `event_id`, `ticket_id`, `ticket_credential_id` — FKs.
- `result VARCHAR(20)` — `ADMITTED` ou `REJECTED`.
- `admission_code VARCHAR(50)` — código estável do `AdmissionPolicy` (ex: `ALREADY_CHECKED_IN`).
- `actor_id UUID` — operador que realizou o scan.
- `idempotency_key TEXT UNIQUE WHERE NOT NULL` — previne duplo envio sem texto fixo.
- `PARTIAL UNIQUE INDEX (ticket_id) WHERE result='ADMITTED'` — **fonte oficial de verdade**: no máximo uma entrada admitida por ticket no PostgreSQL.

### PerformCheckInUseCase

Fluxo principal:

1. Computa `token_hash = SHA-256(token)`.
2. Consulta `ICheckInTicketAccessPort.findByTokenHash(tokenHash, orgId, eventId)` — JOIN em `ticket_credentials → tickets`.
3. Monta `AdmissionContext` (sem PII).
4. Avalia `AdmissionPolicy.evaluate(context)`.
5. Persiste `CheckIn` via `ICheckInRepository.save(checkIn, idempotencyKey)`.
   - `ADMITTED` + PostgresError 23505 → retorna `CheckIn` com `ALREADY_CHECKED_IN` (idempotência a nível de banco).
   - `INVALID_CREDENTIAL` sem ticket real → **não persiste** (não há ticket FK para registrar).
6. Retorna `CheckInResponseDto` com `allowed`, `admissionCode`, `message` (sem PII).

Replay por `Idempotency-Key`: `ON CONFLICT (idempotency_key) WHERE NOT NULL DO UPDATE SET ... RETURNING *`.

### AdmissionCodes estáveis (7)

| Código | Allowed | Significado |
|--------|---------|-------------|
| `VALID` | true | Admitido |
| `INVALID_CREDENTIAL` | false | Token não reconhecido |
| `TICKET_CANCELLED` | false | Ingresso cancelado |
| `ALREADY_CHECKED_IN` | false | Já entrou |
| `EVENT_NOT_ACTIVE` | false | Evento não publicado |
| `WRONG_EVENT` | false | Ingresso de outro evento |
| `TRANSFER_PENDING` | false | Transferência em andamento |

### Endpoint

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/v1/organizations/:orgId/events/:eventId/check-ins` | ActorGuard (X-Dev-User-Id) | Realiza check-in por token |

### Interface de operador (backoffice)

Rota: `/organizations/[orgId]/events/[eventId]/check-in`

Máquina de estado: `SCANNING → VALIDATING → FEEDBACK → SCANNING`

- `CameraScanner` — jsQR frame-a-frame via `requestAnimationFrame`; `getUserMedia({ facingMode: 'environment' }`; stream encerrado no unmount.
- `ManualEntryForm` — fallback quando câmera indisponível; validação 64 hex.
- `DecisionFeedback` — `role="alert"`; verde (`ADMITTED`), vermelho (demais); 7 mensagens pt-BR; auto-retorno em 2s.
- `CheckInPage` — orquestra estados, gera `Idempotency-Key` por scan, detecta offline.

---

## Entidades

### CheckIn

```typescript
export type CheckInResult = 'ADMITTED' | 'REJECTED';

export class CheckIn {
  readonly id: string;
  readonly organizationId: string;
  readonly eventId: string;
  readonly ticketId: string;
  readonly ticketCredentialId: string | null;
  readonly result: CheckInResult;
  readonly admissionCode: AdmissionCode;
  readonly actorId: string;
  readonly performedAt: Date;

  isAdmitted(): boolean { return this.result === 'ADMITTED'; }
}
```

---

## Casos de uso implementados

- `PerformCheckInUseCase` — valida credencial, avalia `AdmissionPolicy`, persiste com idempotência, detecta double check-in via PG 23505.

## Casos de uso previstos

- `UndoCheckIn` — requer permissão superior + auditoria.
- `GetEventCheckInSummary` — dashboard de operações (TASK-040).
- `SearchEventAttendee` — busca por nome ou código.
- `SynchronizeOfflineCheckIns` — modo offline futuro.

---

## Invariantes

- Apenas ingresso `ACTIVE` pode ser admitido.
- Ingresso só pode ter **um** check-in `ADMITTED` — partial unique index no PostgreSQL.
- Check-in pertence ao evento + organização corretos.
- Operador deve ter acesso ao evento (ActorGuard + futura autorização granular).
- `INVALID_CREDENTIAL` sem ticket real **não persiste** — não há FK válida.
- Decisão de admissão vem **sempre** do servidor — nunca simulada no frontend.
- Token do QR nunca logado, exibido em tela ou armazenado no frontend.

---

## Eventos de domínio (previstos)

- `checkin.performed.v1` — admitido ou rejeitado.
- `checkin.undone.v1` — check-in desfeito (futuro).

---

## Portas

| Símbolo | Interface | Implementação |
|---------|-----------|---------------|
| `CHECK_IN_REPOSITORY` | `ICheckInRepository` | `PrismaCheckInRepository` |
| `CHECKIN_EVENT_ACCESS_PORT` | `ICheckInEventAccessPort` | `CheckInEventAccessAdapter` |
| `CHECKIN_TICKET_ACCESS_PORT` | `ICheckInTicketAccessPort` | `CheckInTicketAccessAdapter` |

---

## Dependências permitidas

- `tickets` (via port — nunca import direto de implementação);
- `events` (via port);
- `organizations` (via guard);
- `audit`;
- observabilidade.

## Dependências proibidas

- `payments`;
- `finance`;
- `inventory`;
- notificações síncronas.

---

## Multi-tenancy

Toda operação usa `organizationId + eventId` vindos da rota — nunca inferidos de estado global. Operador só atua nos eventos autorizados.

---

## Segurança

- Token do QR nunca logado integralmente.
- Respostas rejeitadas não expõem dados pessoais.
- `token_hash` **nunca** aparece em response da API.
- Frontend nunca toma decisão de admissão sem resposta 200 do servidor com `allowed: true`.
- `Idempotency-Key` por scan previne duplo envio.

---

## Concorrência

- Double check-in simultâneo: `PARTIAL UNIQUE INDEX (ticket_id) WHERE result='ADMITTED'` + catch `23505 → ALREADY_CHECKED_IN` — garantia no banco, não na aplicação.
- Double scan no frontend: `isLoading` bloqueia novo scan enquanto requisição anterior está em voo.
- Concorrência de rede: `ON CONFLICT (idempotency_key) DO UPDATE` — replay retorna mesmo resultado.

---

## Idempotência

- Mesmo `Idempotency-Key` → mesmo resultado (replay via `ON CONFLICT`).
- Mesmo token sem `Idempotency-Key` → `23505` catch → `ALREADY_CHECKED_IN`.

---

## Testes implementados

**Unitários (6):**
- Token válido → ADMITTED.
- Token inválido → INVALID_CREDENTIAL (sem persitir).
- Ticket cancelado → TICKET_CANCELLED.
- Evento inativo → EVENT_NOT_ACTIVE.
- Replay por idempotency key → mesmo resultado.
- Evento com orgId errado → WRONG_EVENT.

**Integração (10):**
- POST → ADMITTED (201).
- POST → ALREADY_CHECKED_IN (token já usado).
- POST → INVALID_CREDENTIAL (token desconhecido).
- POST → TICKET_CANCELLED.
- POST → WRONG_EVENT (outro evento).
- POST → EVENT_NOT_ACTIVE.
- Idempotency-Key replay → 200 com mesmo resultado.
- Sem ActorGuard header → 401.
- Concorrência: 2 POSTs simultâneos → exatamente um ADMITTED + um ALREADY_CHECKED_IN.
- `token_hash` ausente das respostas.

---

## Métricas previstas

- `checkins_performed`;
- `checkins_rejected`;
- `checkin_duration_ms`;
- `duplicate_checkins`;
- `checkin_conflicts`.
