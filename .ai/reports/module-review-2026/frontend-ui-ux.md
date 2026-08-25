# Frontend UI/UX Review — 2026-08-24

## Scope
- `apps/marketplace-web` — public-facing event catalog, checkout, tickets, transfers
- `apps/backoffice-web` — event management, check-in, finance, organization management

Both apps: Next.js 15 App Router, Tailwind CSS, design system tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `text-primary`, etc.)

---

## Issues Found and Fixed

### marketplace-web

#### 1. `TicketSelection.tsx` — "Subtotal visual:" dev label shown to users (FIXED)
- **Before:** `Subtotal visual: R$ 100,00` — "visual" was a developer note leaked into the UI
- **After:** `Subtotal: R$ 100,00`
- Also renamed per-ticket line from `Subtotal:` to `Parcial:` to disambiguate from the overall total

#### 2. `TicketCard.tsx` — Raw DB enum status shown to users (FIXED)
- **Before:** "Ingresso 1 — ACTIVE"
- **After:** "Ingresso 1 — Ativo" using a `STATUS_LABELS` map
- Handles: ACTIVE→Ativo, CANCELLED→Cancelado, USED→Utilizado, TRANSFERRED→Transferido

#### 3. `AcceptTransferPage.tsx` — Multiple UX issues (FIXED)
- **ACCEPTING state**: previously showed "Você recebeu um ingresso. Deseja aceitar?" (same as CONFIRMING) — now shows "Processando a transferência…" to reflect actual state
- **ACCEPTING button**: added `aria-busy={true}` when processing
- **EXPIRED state**: had no heading, just a bare paragraph → added `<h1>Link expirado</h1>`
- **ALREADY_ACCEPTED state**: same issue → added `<h1>Ingresso já transferido</h1>`
- **ERROR state**: added `<h1>Erro ao transferir</h1>`
- **Code deduplication**: merged CONFIRMING/ACCEPTING into a single render branch with conditional text/state

#### 4. `InitiateTransferModal.tsx` — Missing keyboard interaction (FIXED)
- Added `useEffect` that listens for `Escape` key and calls `onClose()` when modal is not in `LOADING` state
- This follows the WAI-ARIA dialog pattern requirement: Escape must close dialogs

### backoffice-web

#### 5. `DecisionFeedback.tsx` — Hardcoded Tailwind colors break dark mode (FIXED)
- **Before:** `bg-green-100 text-green-800` / `bg-red-100 text-red-800` — hardcoded values that won't adapt to dark mode
- **After:** `bg-primary/10 text-primary` / `bg-destructive/10 text-destructive` — semantic design system tokens

#### 6. `PayoutRequestModal.tsx` — Missing ARIA attributes + wrong success color (FIXED)
- Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="payout-modal-title"` to modal container
- Added `id="payout-modal-title"` to `<h2>` title
- Changed success message from `text-green-600` to `text-primary` (semantic)
- Added `useEffect` to close modal on `Escape` key when not pending

#### 7. `EventDetail.tsx` — SSR hydration mismatch with `toLocaleString()` (FIXED)
- **Before:** `new Date(event.createdAt).toLocaleString('pt-BR')` — server renders in UTC, client renders in local timezone → hydration mismatch warning in Next.js
- **After:** Added `timeZone: 'America/Sao_Paulo'` option (consistent server/client), wrapped in `<time dateTime={event.createdAt}>`, added `suppressHydrationWarning` as safety net

---

## Correções Implementadas — 2026-08-25

| ID | Correção | Arquivo |
|---|---|---|
| MK-02 | Botão "Copiar código PIX" adicionado com `navigator.clipboard.writeText`. Estado `copied` com feedback visual por 2s. | `PaymentStatusView.tsx` |
| MK-01 | `toLocaleTimeString` com `timeZone: 'America/Sao_Paulo'` + `<time suppressHydrationWarning>`. | `PaymentStatusView.tsx` |

---

## Issues Found But Not Fixed (documented for tracking)

### marketplace-web

- **`CheckoutPage.tsx`**: LOADING state shows plain text "Preparando seu checkout…" without any visual loading spinner. The `aria-busy="true"` is good but no animation for visual users.
- **`EventDetails.tsx`**: The static event ticket list shows a price list but doesn't link to ticket selection. Users must scroll down to find the TicketSelection component — no "Comprar ingressos" anchor link from the ticket type list to the selection widget.
- **`TicketCard.tsx`**: The "Transferir" button opens a modal but there's no visual indicator that a transfer is already pending for this ticket. A user could try to initiate a second transfer without realizing one is already in progress.

### backoffice-web

- **`CheckInPage.tsx`**: Uses `NEXT_PUBLIC_DEV_USER_ID` environment variable as the authenticated user ID. This is a dev-only placeholder — production auth needs to read the user ID from the session/JWT. Current code silently sends an empty string if env var is not set.
- **`CheckInPage.tsx`**: The `VALIDATING` state shows "Validando ingresso..." as text but no spinner/animation — visual users may not realize the scan was processed.
- **`CreateEventForm.tsx`**: Only collects `title` and `description`. Missing fields: `format`, `startsAt`, `endsAt`, `timezone`, `venue`, currency. These are likely filled in a separate edit flow, but creating an event with only title creates a DRAFT with minimal data.
- **`BalanceSummaryCards.tsx`**: No retry button when balance fetch fails — user sees a static error message with no way to retry without reloading the page.
- **`TransactionHistoryTable.tsx` / `PayoutHistoryTable.tsx`**: Not reviewed — likely have pagination and empty state handling worth checking.

---

## Accessibility Summary

**Good practices found:**
- `aria-label` on quantity controls in TicketSelection
- `role="dialog" aria-modal="true"` on InitiateTransferModal (was missing from PayoutRequestModal, now fixed)
- `role="alert"` on error messages
- `aria-live="polite"` for status updates in CheckInPage and CheckoutPage
- `tabIndex={-1}` with `.focus()` on error messages in CheckoutPage
- Semantic HTML (`<article>`, `<section>`, `<header>`, `<dl>/<dt>/<dd>`, `<time>`)
- `sr-only` countdown text in CheckoutPage

**Remaining gaps:**
- No focus trap in modals (Tab key can escape outside dialog bounds)
- No `aria-describedby` linking modal description to dialog
- CheckInPage: no `aria-live` announcement for `FEEDBACK` state
