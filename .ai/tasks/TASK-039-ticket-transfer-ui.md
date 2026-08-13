# TASK-039 — Ticket Transfer Experience

## Status

PLANNED

## Objetivo

Interface de transferência no marketplace: remetente inicia e cancela transferência; destinatário aceita via link público. Credential é rotacionada ao aceite.

## Resultado observável

- Comprador vê botão "Transferir" em cada ingresso na página de pedido.
- Ao clicar: aviso claro de que o QR atual será invalidado → link de claim gerado.
- Comprador pode copiar o link ou cancelar antes do aceite.
- Destinatário acessa `/transfer/accept/[claimToken]` → confirma → recebe instrução de gerar novo QR.
- Link expirado ou já aceito exibe mensagem adequada sem detalhes internos.
- Após aceite, o QR antigo do remetente não é mais válido (credencial revogada).

## Contexto obrigatório

O agente deve ler somente:

- `AGENTS.md`
- `.ai/tasks/TASK-039-ticket-transfer-ui.md`
- `apps/marketplace-web/src/shared/api/` (cliente existente)
- `apps/marketplace-web/src/features/` (padrão de features existente)
- `apps/marketplace-web/tsconfig.json`
- Contratos de TASK-038: `POST .../transfer`, `DELETE .../transfer`, `POST /public/transfers/:claimToken/accept`

## Arquivos permitidos

O agente pode criar ou alterar somente:

- `apps/marketplace-web/src/shared/api/transfers.api.ts`
- `apps/marketplace-web/src/features/tickets/components/TicketCard.tsx`
- `apps/marketplace-web/src/features/tickets/components/TicketCard.test.tsx`
- `apps/marketplace-web/src/features/transfer/components/InitiateTransferModal.tsx`
- `apps/marketplace-web/src/features/transfer/components/InitiateTransferModal.test.tsx`
- `apps/marketplace-web/src/features/transfer/components/CancelTransferButton.tsx`
- `apps/marketplace-web/src/features/transfer/components/CancelTransferButton.test.tsx`
- `apps/marketplace-web/src/app/transfer/accept/[claimToken]/page.tsx`
- `apps/marketplace-web/src/features/transfer/components/AcceptTransferPage.tsx`
- `apps/marketplace-web/src/features/transfer/components/AcceptTransferPage.test.tsx`

## Arquivos proibidos

O agente não pode alterar:

- qualquer arquivo fora do marketplace e da lista permitida;
- API backend;
- módulos do backoffice;
- lockfile;
- documentação não relacionada.

## Requisitos funcionais

- **Remetente (marketplace):**
  - Botão "Transferir" em cada `TicketCard` na listagem de ingressos.
  - Modal de confirmação: aviso de que o QR atual será invalidado ao aceite.
  - Após confirmação: chamada `POST .../transfer` → exibir link de claim e botão "Copiar".
  - Botão "Cancelar transferência" enquanto status for `PENDING`.
  - Cache de tickets invalidado após iniciar ou cancelar.

- **Destinatário (página pública):**
  - `/transfer/accept/[claimToken]` exibe resumo do ingresso (sem dados sensíveis) e botão "Aceitar".
  - Após aceite: instrução de acessar o app do remetente para gerar novo QR.
  - Link expirado: mensagem "Este link expirou" sem dados do ticket.
  - Link já aceito: mensagem "Este ingresso já foi transferido".

## Requisitos técnicos

- Cliente tipado em `transfers.api.ts` para os 3 endpoints de TASK-038.
- Sem estado global — TanStack Query para dados remotos.
- `Idempotency-Key` gerado por `crypto.randomUUID()` em cada `POST accept`.
- `claimToken` não exibido na URL de forma crua — a rota usa o token diretamente (já está no path).
- Sem informação de preço, `orderId`, `credentialToken` ou hash em qualquer tela.

## Invariantes

- Token de transferência nunca exibido como "código de validação" — apenas como link de claim.
- Aviso de invalidação do QR sempre exibido antes de iniciar transferência.
- Sem tentativa de validação offline.

## Segurança

- `claimToken` viaja apenas na URL — não armazenado em `localStorage` ou `sessionStorage`.
- Nenhum dado financeiro ou PII do remetente exibido na página de aceite.
- Página de aceite funciona sem autenticação (qualquer pessoa com o link pode aceitar).

## Multi-tenancy

Não aplicável no frontend: `orgId` e `eventId` vêm da sessão do comprador (via token de reserva no contexto da feature de ingressos).

## Concorrência

Não aplicável no frontend: servidor garante atomicidade.

## Idempotência

- Botão "Aceitar" desabilitado durante requisição (`isLoading`) para prevenir duplo envio.
- `Idempotency-Key` único por clique.

## Fora do escopo

- Notificação por email ao destinatário.
- Histórico de transferências do comprador.
- Transferência reversa (aceitar e re-transferir).
- Limite de transferências por ingresso.
- QR visual na página de aceite.

## Critérios de aceite

- comportamento principal implementado;
- nenhum arquivo fora do escopo alterado;
- typecheck aprovado;
- testes unitários aprovados (mínimo 8: iniciar, cancelar, aceitar, link expirado, link aceito, aviso de QR, double click, cache invalidado);
- sem dados sensíveis em tela (hash, `orderId`, `credentialToken`);
- nenhuma dependência adicionada sem justificativa.

## Comandos

```bash
pnpm --filter @ticket-seller/marketplace-web typecheck
pnpm --filter @ticket-seller/marketplace-web test
pnpm --filter @ticket-seller/marketplace-web build
```

## Conclusão esperada

### Arquivos alterados

- `apps/marketplace-web/src/shared/api/transfers.api.ts`: criado
- `apps/marketplace-web/src/features/transfer/`: feature completa criada
- `apps/marketplace-web/src/app/transfer/accept/[claimToken]/page.tsx`: rota criada

### Implementado

- Fluxo remetente: iniciar + cancelar transferência com aviso de QR.
- Fluxo destinatário: aceitar via link público com estados de expirado/aceito.

### Testes

```
pnpm test: aprovado
```

### Decisões

[a preencher pelo implementador]

### Pendências

Nenhuma.

### Próxima tarefa

TASK-040 — Event Attendance & Operations Dashboard.
