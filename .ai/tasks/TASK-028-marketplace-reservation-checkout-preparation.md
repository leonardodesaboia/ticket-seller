# TASK-028 — Marketplace Reservation & Checkout Preparation

## Status

MERGED em develop

## Objetivo

Implementar no marketplace o fluxo visual:

```
evento público
→ selecionar ingressos (com disponibilidade real)
→ ver subtotal visual
→ reservar (POST /public/reservations)
→ countdown baseado em expiresAt do servidor
→ checkout com resumo do pedido (POST /public/orders)
→ página de checkout preparada para pagamento futuro
```

Não implementar pagamento real.

## Dependências

TASK-025, TASK-026 e TASK-027 integradas em develop. Contratos FROZEN.

## Propriedade exclusiva

- `apps/marketplace-web/src/features/ticket-selection/`
- `apps/marketplace-web/src/features/reservation/`
- `apps/marketplace-web/src/features/checkout/`
- `apps/marketplace-web/src/app/events/[slug]/page.tsx` (evolução)
- `apps/marketplace-web/src/app/checkout/[reservationId]/` (nova rota)
- `apps/marketplace-web/src/shared/api/` (novos clientes: availability, reservations, orders)

## Fora do escopo

PSP, pagamento real, botão de pagamento funcional, cupom, desconto, taxa, emissão de ingresso, QR Code.

## Features

### ticket-selection/

Componente de seleção de ingressos para a página do evento:
- Para cada ticket type ativo: nome, descrição, preço formatado, seletor de quantidade, subtotal visual.
- Quantidade mínima: 0; máxima: limitada por `availableQuantity` (da API).
- Seleção vazia não habilita reserva.
- Subtotal visual calculado no frontend (apenas UX — valor do backend prevalece).
- Estados: loading, disponível, indisponível (availableQuantity === 0), quantidade insuficiente.

### reservation/

- Hook `useCreateReservation` com idempotency key estável por tentativa.
- Salvar token em `sessionStorage` (chave: `reservation_token_{reservationId}`).
- Não logar token.
- Hook `useGetReservation` para recuperar estado após refresh.
- Countdown baseado em `expiresAt` retornado pelo servidor.
  - Timer é só visual.
  - Quando atingir zero: bloquear continuação, mostrar mensagem de expiração, oferecer voltar ao evento.
- Recovery pós-refresh: verificar `sessionStorage` por `reservation_id` ativo, tentar GET, se expirado limpar e mostrar página fresca.

### checkout/

- Página `/checkout/[reservationId]`.
- Criar pedido ao chegar na página (POST /public/orders com token + reservationId).
- Mostrar: evento, itens, quantidade, preço unitário, subtotal, total, moeda, tempo restante.
- Mensagem: "Pagamento será disponibilizado na próxima etapa."
- Não criar botão de pagamento funcional.
- Estados: criando pedido (loading), pedido criado (checkout), pedido expirado (mensagem + link para evento), erro (retry).

## Clientes API

```
shared/api/public-availability.api.ts
shared/api/public-reservations.api.ts
shared/api/public-orders.api.ts
```

Reutilizar `formatCurrency` e `formatDateTime` do `shared/lib/`.

## Acessibilidade

- Botões de quantidade com `aria-label` (ex: "Aumentar quantidade de Inteira").
- Labels em todos os inputs.
- Countdown com `aria-live="polite"` (não excessivo — atualizar a cada minuto, não a cada segundo).
- Erros com `role="alert"` e foco.
- Estados disabled com contraste suficiente.
- Navegação por teclado em seletores de quantidade.

## Idempotência no frontend

- Gerar `Idempotency-Key` ao montar o formulário de reserva.
- Reutilizar a mesma chave em retries (não gerar nova chave para a mesma operação).
- Gerar nova chave somente quando o usuário alterar a seleção ou após expiração/cancelamento.

## Persistência

- Token salvo em `sessionStorage` (não `localStorage`).
- Ao abrir `/checkout/[reservationId]`, recuperar token de `sessionStorage`.
- Se token ausente: redirecionar para página do evento com mensagem de sessão perdida.

## Páginas/rotas

- `/events/[slug]` — evolução: adicionar seção de seleção de ingressos abaixo da descrição existente.
- `/checkout/[reservationId]` — nova rota.

## Testes

- selecionar quantidade aumenta/diminui contador;
- subtotal visual atualiza;
- quantidade 0 desabilita botão de reservar;
- `availableQuantity = 0` desabilita seletor;
- criar reserva → salva token → countdown inicia;
- idempotency key reutilizada em retry;
- valor do backend prevalece sobre subtotal visual;
- countdown exibe tempo restante;
- countdown zerado bloqueia continuação;
- recovery pós-refresh com token válido;
- recovery pós-refresh com token expirado limpa estado;
- checkout cria pedido ao abrir página;
- checkout mostra itens do pedido;
- erro na criação do pedido exibe mensagem com retry;
- duplo clique em reservar não duplica chamada;
- acessibilidade: botões com aria-label.

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
