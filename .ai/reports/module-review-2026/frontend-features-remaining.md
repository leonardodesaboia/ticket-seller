# Frontend Features — Revisão Complementar (2026-08-25)

## Escopo

Features ainda não cobertas pelas sessões anteriores:

**backoffice-web**
- `features/attendance/` — AttendanceDashboard, AttendanceStats, RecentCheckIns, useAttendancePolling
- `features/finance/` — BalanceSummaryCards, FinancialSummaryPanel, PayoutHistoryTable, TransactionHistoryTable, PayoutRequestModal, hooks, currency lib
- `features/platform-admin/` — AdminDashboardCards, OrganizationsAdminTable, UsersAdminTable, hooks, admin.api
- `features/organizations/` — CreateOrganizationForm, hook, schema, api
- `features/publication-readiness/` — PublicationChecklist, hook, api, issue-catalog
- `features/publish-event/` — PublishEventPanel, hook, api, idempotency lib

**marketplace-web**
- `features/checkout/` — CheckoutPage
- `features/payment-method/` — SelectMethodView
- `features/payment-status/` — PaymentStatusView, usePaymentPolling, payment-session
- `features/public-event-catalog/` — CatalogHome, EventList, EventCard
- `features/reservation/` — use-countdown, use-create-reservation, reservation-session
- `features/order-confirmation/` — ConfirmationView

Stack: Next.js 15 App Router · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form · Zod

---

## Problemas encontrados

### backoffice-web

---

#### BO-01 — ALTO

**Arquivo:** `apps/backoffice-web/src/features/attendance/hooks/useAttendancePolling.ts`

**Trecho:**
```ts
const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';
// ...
const result = await getEventAttendance(orgId, eventId, DEV_USER_ID);
```

**Problema:** O ID do usuário autenticado é lido de uma variável de ambiente `NEXT_PUBLIC_` em runtime no cliente e passado como header de autenticação para a API. Em produção, se a variável não estiver definida, a requisição é enviada com `X-Dev-User-Id: ''` (string vazia), o que pode resultar em requisições sem identificação de usuário passando pela API dependendo da guarda implementada no backend. É um padrão de autenticação de desenvolvimento incorretamente projetado para produção.

**Impacto:** Requisições de presença em tempo real enviadas sem identidade de usuário válida em produção. Dependendo da guarda da API, pode resultar em acesso não autorizado ou erro silencioso com dados corrompidos.

**Correção recomendada:** Substituir pela leitura do token/session de usuário autenticado via contexto de sessão (cookie httpOnly ou contexto de autenticação). Remover `DEV_USER_ID` do módulo.

---

#### BO-02 — ALTO

**Arquivo:** `apps/backoffice-web/src/features/platform-admin/api/admin.api.ts`

**Trecho:**
```ts
export async function suspendOrganization(orgId, reason, devUserId?): Promise<void> { ... }
export async function unsuspendOrganization(orgId, reason, devUserId?): Promise<void> { ... }
export async function suspendUser(userId, reason, devUserId?): Promise<void> { ... }
export async function unsuspendUser(userId, reason, devUserId?): Promise<void> { ... }
export async function blockPayout(payoutId, reason, devUserId?): Promise<void> { ... }
```

**Problema:** Todas as ações administrativas destrutivas (suspender organização, suspender usuário, bloquear payout) utilizam `devUserId` opcional como único vetor de autenticação. Se `devUserId` não for fornecido, o header `X-Dev-User-Id` simplesmente não é enviado. Não há validação do lado do cliente garantindo que o usuário é efetivamente um administrador de plataforma antes de exibir esses controles. A proteção depende 100% do backend — o que é correto para autorização, mas a ausência de qualquer indicação de role no frontend deixa a possibilidade de botões de "Suspender" aparecendo para usuários sem permissão.

**Impacto:** Usuários não-admin que acessarem a rota de platform-admin (por qualquer razão) verão botões de ações destrutivas sem nenhum feedback de permissão até a falha na API.

**Correção recomendada:** Verificar o role do usuário autenticado no layout/page de platform-admin e não renderizar os componentes de administração caso o usuário não possua `PLATFORM_ADMIN`. Adicionar uma guarda de role no componente ou na page-level.

---

#### BO-03 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/finance/components/PayoutHistoryTable.tsx` e `TransactionHistoryTable.tsx`

**Trecho:**
```tsx
{new Date(payout.requestedAt).toLocaleString('pt-BR')}
// e
{new Date(tx.occurredAt).toLocaleString('pt-BR')}
```

**Problema:** `toLocaleString('pt-BR')` sem opção `timeZone` causa divergência entre server e client no SSR. O servidor renderiza em UTC, o cliente renderiza no fuso local do usuário. Isso gera hydration mismatch — idêntico ao problema já corrigido em `EventDetail.tsx` na sessão anterior.

**Impacto:** Warning de hydration no console durante desenvolvimento; em produção pode causar texto oscilante (flicker) na primeira renderização quando o cliente re-hidrata com valor diferente.

**Correção recomendada:**
```tsx
new Date(payout.requestedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
```
Ou envolver em elemento `<time dateTime={payout.requestedAt} suppressHydrationWarning>`. Padronizar em um helper `formatLocalDateTime(isoString)` no `shared/lib`.

---

#### BO-04 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/attendance/components/RecentCheckIns.tsx`

**Trecho:**
```tsx
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
```

**Problema:** `toLocaleTimeString('pt-BR')` sem `timeZone` tem o mesmo problema de hydration mismatch descrito em BO-03. Adicionalmente, o componente usa `index` como `key` na lista de check-ins:

```tsx
{items.map((ci, index) => (
  <tr key={index} className="border-t">
```

O uso de índice como `key` causa problemas de reconciliação quando a lista é atualizada por polling (novos items chegam no início ou meio da lista), podendo causar animações incorretas ou estados de componente incorretos.

**Impacto:** Hydration mismatch no horário; reconciliação incorreta quando a lista de check-ins é atualizada em tempo real via polling a cada 15s.

**Correção recomendada:** Adicionar `timeZone: 'America/Sao_Paulo'` ao `toLocaleTimeString`. Usar `ci.checkedInAt + ci.performedByUserId` ou um campo de ID estável como `key`.

---

#### BO-05 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/finance/hooks/usePayouts.ts` e `useTransactions.ts`

**Trecho:**
```ts
const query = useQuery({
  queryKey: ['finance', 'payouts', organizationId, cursor],
  queryFn: async () => {
    const result = await listPayouts(...);
    if (cursor === undefined) {
      setAllItems(result.data);          // ← setState dentro do queryFn
    } else {
      setAllItems((prev) => [...prev, ...result.data]);
    }
    return result;
  },
  ...
});
```

**Problema:** Chamar `setAllItems` dentro do `queryFn` do TanStack Query é um anti-padrão. O `queryFn` deve ser uma função pura que retorna dados; efeitos colaterais de estado dentro do `queryFn` executam durante a renderização do React (em React Strict Mode executam duas vezes), e o TanStack Query pode re-executar o `queryFn` em situações de background refetch — causando duplicação de itens no array `allItems`. O estado remoto (lista paginada) está sendo duplicado em estado local desnecessariamente.

**Impacto:** Em desenvolvimento com React Strict Mode, itens podem ser duplicados. Em produção, um background refetch ao retornar à aba pode causar duplicação. Viola a separação de responsabilidades do TanStack Query.

**Correção recomendada:** Usar `useInfiniteQuery` do TanStack Query para paginação cursor-based, que gerencia o acúmulo de páginas internamente. Alternativamente, derivar `allItems` via `useMemo` a partir do cache do query, sem `useState` secundário.

---

#### BO-06 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/platform-admin/components/OrganizationsAdminTable.tsx` e `UsersAdminTable.tsx`

**Trecho:**
```tsx
<button onClick={() => openSuspend(org.id, org.name)} ...>
  Suspender
</button>
```

**Problema:** Os botões de ação nas tabelas não possuem `type="button"` explícito. Embora seja improvável que estejam dentro de um `<form>`, é uma prática recomendada para evitar submissão acidental de formulário pai. Mais importante: o `actionError` é exibido como `<p className="text-sm text-destructive">` sem `role="alert"` — erros de ação são assíncronos e leitores de tela não serão notificados.

```tsx
{actionError && (
  <p className="text-sm text-destructive">{actionError}</p>
)}
```

**Impacto:** Usuários de leitores de tela não são notificados de erros nas ações de suspensão/reativação.

**Correção recomendada:** Adicionar `type="button"` nos botões de ação. Adicionar `role="alert"` ou `aria-live="assertive"` no `actionError`.

---

#### BO-07 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/platform-admin/components/OrganizationsAdminTable.tsx` e `UsersAdminTable.tsx`

**Trecho:**
```tsx
<div className="flex items-center gap-2">
  {cursor && (
    <button onClick={() => setCursor(undefined)} ...>Início</button>
  )}
  {data.nextCursor && (
    <button onClick={() => setCursor(data.nextCursor ?? undefined)} ...>Próxima página</button>
  )}
</div>
```

**Problema:** Os botões de paginação não têm `type="button"`. Mais relevante: a paginação é "anterior/próxima" mas a tabela não exibe nenhum indicador de página atual, número de páginas ou de registros. Com 50 itens por página e potencialmente milhares de organizações/usuários, o administrador não tem referência de onde está na lista.

**Impacto:** UX degradada para administradores gerenciando grandes volumes de organizações/usuários.

**Correção recomendada:** Adicionar `type="button"`. Adicionar indicador de estado como "Exibindo X organizações — próxima página disponível" ou numeração de página.

---

#### BO-08 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/finance/components/FinancialSummaryPanel.tsx`

**Trecho:**
```tsx
function periodDates(days: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
```

**Problema:** `periodDates` é chamada diretamente durante o render (`const { from, to } = periodDates(period)`). `new Date()` retorna valores diferentes entre server e client, causando hydration mismatch. Além disso, os botões de período não possuem `aria-pressed` para indicar qual período está selecionado — leitores de tela não distinguem o estado ativo.

**Impacto:** Potencial hydration mismatch na carga inicial (menos crítico pois o componente é `'use client'`); inacessibilidade dos controles de período para leitores de tela.

**Correção recomendada:** Mover a geração de datas para dentro do `queryFn` ou `useEffect`. Adicionar `aria-pressed={period === p}` nos botões de período:
```tsx
<button aria-pressed={period === p} ...>
```

---

#### BO-09 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/platform-admin/components/AdminDashboardCards.tsx`

**Trecho:**
```tsx
<span ...>{value.toLocaleString('pt-BR')}</span>
```

**Problema:** `toLocaleString('pt-BR')` em um Server Component (ou durante SSR) pode diferir do cliente dependendo da localidade do servidor Node.js. Para números inteiros simples, o risco é menor, mas é inconsistente com as demais formatações do projeto.

**Impacto:** Baixo risco de hydration mismatch para números inteiros, mas inconsistente com o padrão do projeto.

**Correção recomendada:** Usar `Intl.NumberFormat('pt-BR').format(value)` com `timeZone` explícito quando datas estiverem envolvidas, ou `suppressHydrationWarning` no elemento.

---

#### BO-10 — MÉDIO

**Arquivo:** `apps/backoffice-web/src/features/publish-event/components/PublishEventPanel.tsx`

**Trecho:**
```tsx
{confirming ? (
  <div className="flex flex-col gap-2 rounded-md border border-input p-3">
    <p className="text-sm text-foreground">
      Publicar este evento torna-o público e bloqueia novas edições. Confirmar?
    </p>
    <div className="flex gap-3">
      <button type="button" onClick={handlePublish} ...>
```

**Problema:** O painel de confirmação de publicação não possui `role="alertdialog"` nem foca automaticamente o botão de confirmação ou cancelamento quando aparece. O usuário que ativou "Publicar evento" via teclado perderá o foco (o botão é substituído pelo painel inline). Adicionalmente, o `errorRef` usa `tabIndex={-1}` com `.focus()` no erro — padrão correto — mas o painel de confirmação não notifica leitores de tela da mudança de estado.

**Impacto:** Usuários de teclado perdem o foco ao confirmar publicação; leitores de tela não anunciam o aparecimento do painel de confirmação.

**Correção recomendada:** Adicionar `aria-live="polite"` ou `role="status"` no container do painel de confirmação. Usar `useEffect` para focar o botão de confirmação quando `confirming` mudar para `true`.

---

#### BO-11 — BAIXO

**Arquivo:** `apps/backoffice-web/src/features/finance/components/PayoutHistoryTable.tsx`

**Trecho:**
```tsx
const STATUS_CLASSES: Record<PayoutStatus, string> = {
  HELD: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  REVERSED: 'bg-orange-100 text-orange-700',
  ...
};
```

**Problema:** Classes Tailwind hardcoded com valores literais de cor (`yellow-100`, `blue-100`, `green-100`, `orange-100`) violam o design system baseado em tokens semânticos. Essas cores não se adaptarão a temas dark mode e serão inconsistentes com outros badges do sistema.

**Impacto:** Inconsistência visual e quebra de dark mode nos badges de status de payout.

**Correção recomendada:** Mapear para tokens semânticos disponíveis:
- `HELD` → `bg-warning/10 text-warning` (ou equivalente no design system)
- `PROCESSING` → `bg-primary/10 text-primary`
- `PAID` → `bg-secondary/10 text-secondary-foreground`
- `REVERSED` → `bg-muted text-muted-foreground`

Se o design system não tiver token `warning`, criar um ou usar `bg-destructive/10 text-destructive` para estados de atenção.

---

#### BO-12 — BAIXO

**Arquivo:** `apps/backoffice-web/src/features/finance/components/TransactionHistoryTable.tsx`

**Trecho:**
```tsx
className={`rounded-full px-2 py-0.5 text-xs font-medium ${
  tx.entryType === 'CREDIT'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'
}`}
```

**Problema:** Mesmo padrão do BO-11 — cores hardcoded `green-100`, `green-700`, `red-100`, `red-700` nos badges de CREDIT/DEBIT.

**Impacto:** Inconsistência visual e quebra de dark mode.

**Correção recomendada:**
- `CREDIT` → `bg-primary/10 text-primary`
- `DEBIT` → `bg-destructive/10 text-destructive`

---

#### BO-13 — BAIXO

**Arquivo:** `apps/backoffice-web/src/features/platform-admin/components/OrganizationsAdminTable.tsx` e `UsersAdminTable.tsx`

**Trecho:**
```tsx
<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
  Ativa
</span>
// e
<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
  Ativo
</span>
```

**Problema:** Mesmo padrão dos itens BO-11 e BO-12 — cores hardcoded `green-100`/`green-700` nos badges de status "Ativa"/"Ativo".

**Impacto:** Inconsistência visual e quebra de dark mode.

**Correção recomendada:** Usar `bg-secondary text-secondary-foreground` ou token semântico equivalente para status ativo/positivo.

---

#### BO-14 — BAIXO

**Arquivo:** `apps/backoffice-web/src/features/organizations/components/CreateOrganizationForm.tsx`

**Trecho:**
```tsx
{errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
```

**Problema:** As mensagens de erro de validação são renderizadas como `<span>` sem `role="alert"` nem `aria-live`. Como aparecem após tentativa de submit, leitores de tela não anunciam automaticamente os erros de campo.

**Impacto:** Inacessibilidade das mensagens de validação para usuários de leitores de tela.

**Correção recomendada:** Associar erros via `aria-describedby` no campo:
```tsx
<input id="name" aria-describedby={errors.name ? 'name-error' : undefined} ... />
{errors.name && (
  <span id="name-error" role="alert" className="text-xs text-destructive">
    {errors.name.message}
  </span>
)}
```

---

#### BO-15 — BAIXO

**Arquivo:** `apps/backoffice-web/src/features/finance/components/BalanceSummaryCards.tsx`

**Trecho:**
```tsx
if (error || !balance) {
  return (
    <p className="text-sm text-destructive">Erro ao carregar saldo.</p>
  );
}
```

**Problema:** Conforme já documentado no relatório anterior como "não corrigido", o estado de erro não oferece botão de retry. O usuário vê um erro estático e precisa recarregar a página inteira. Registrado aqui para completude do escopo desta revisão.

**Impacto:** UX degradada — sem possibilidade de recuperação sem reload de página.

**Correção recomendada:** Adicionar botão de retry que chame `refetch()` do hook `useBalance`:
```tsx
if (error || !balance) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-destructive">Erro ao carregar saldo.</p>
      <button type="button" onClick={() => void refetch()} className="text-sm text-primary underline">
        Tentar novamente
      </button>
    </div>
  );
}
```

---

### marketplace-web

---

#### MK-01 — ALTO

**Arquivo:** `apps/marketplace-web/src/features/payment-status/PaymentStatusView.tsx`

**Trecho:**
```tsx
<p className="text-xs text-muted-foreground">
  Expira em: {new Date(attempt.expiresAt).toLocaleTimeString('pt-BR')}
</p>
```

**Problema:** `toLocaleTimeString('pt-BR')` sem `timeZone` na expiração do PIX causa hydration mismatch idêntico ao BO-03/BO-04. Este componente é `'use client'`, mas a primeira renderização no servidor produzirá um horário diferente do cliente se os fusos divergirem.

**Impacto:** Hydration mismatch — horário de expiração do PIX pode oscilar na primeira renderização, gerando confusão no usuário durante o fluxo crítico de pagamento.

**Correção recomendada:**
```tsx
<time dateTime={attempt.expiresAt} suppressHydrationWarning>
  Expira em: {new Date(attempt.expiresAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
</time>
```

---

#### MK-02 — ALTO

**Arquivo:** `apps/marketplace-web/src/features/payment-status/PaymentStatusView.tsx`

**Trecho:**
```tsx
{isPix && attempt.checkoutData?.qrCodeText && !isFailed && (
  <div className="flex flex-col gap-4">
    ...
    <div className="rounded-md border border-input bg-muted p-3">
      <code aria-label="Código PIX copia e cola">
        {attempt.checkoutData.qrCodeText}
      </code>
    </div>
  </div>
)}
```

**Problema:** O código PIX é exibido mas não há botão de "Copiar" que chame `navigator.clipboard.writeText()`. O usuário precisa selecionar manualmente o texto (difícil em mobile) e copiar. Fluxos PIX em produção no Brasil dependem universalmente do botão "Copiar código" para funcionar corretamente em apps bancários.

**Impacto:** UX crítica — usuários em mobile praticamente não conseguem completar o pagamento PIX sem o botão de copiar.

**Correção recomendada:** Adicionar botão de copiar:
```tsx
<button
  type="button"
  onClick={() => void navigator.clipboard.writeText(attempt.checkoutData.qrCodeText)}
  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
>
  Copiar código PIX
</button>
```

---

#### MK-03 — MÉDIO

**Arquivo:** `apps/marketplace-web/src/features/checkout/components/CheckoutPage.tsx`

**Trecho:**
```tsx
if (checkoutState === 'LOADING') {
  return <main className="mx-auto max-w-2xl p-8" aria-busy="true">Preparando seu checkout…</main>;
}
```

**Problema:** O estado LOADING mostra apenas texto plano sem indicador visual de progresso. Conforme já documentado no relatório anterior como "não corrigido", registrado aqui para completude do escopo. Adicionalmente: `aria-busy="true"` sem `aria-label` no `<main>` não fornece contexto suficiente para leitores de tela — seria melhor combinar com `role="status"` ou um `<p role="status">`.

**Impacto:** UX visual degradada; feedback de acessibilidade incompleto durante loading.

**Correção recomendada:** Adicionar spinner visual e melhorar o markup:
```tsx
<main className="mx-auto max-w-2xl p-8">
  <p role="status" className="text-muted-foreground">Preparando seu checkout…</p>
</main>
```

---

#### MK-04 — MÉDIO

**Arquivo:** `apps/marketplace-web/src/features/order-confirmation/ConfirmationView.tsx`

**Trecho:**
```tsx
useEffect(() => {
  let cancelled = false;
  getOrderTickets(orderId, token)
    .then((data) => {
      if (!cancelled) setTickets(data.tickets);
    })
    .catch(() => {
      if (!cancelled) setError('Não foi possível carregar seus ingressos. Recarregue a página.');
    });
  return () => { cancelled = true; };
}, [orderId, token]);
```

**Problema:** O carregamento dos ingressos usa fetch manual com `useEffect` em vez de TanStack Query. Isso significa: sem cache, sem deduplicação de requisições, sem retry automático, sem `isLoading`/`isError` gerenciados. Adicionalmente, o estado de erro não oferece botão de retry — o usuário que pagou e não consegue ver os ingressos precisa recarregar a página inteira manualmente (UX crítica pós-pagamento).

**Impacto:** UX crítica — usuário que confirmou pagamento e não vê ingressos (por erro de rede) fica preso sem ação clara de recuperação.

**Correção recomendada:** Migrar para TanStack Query e adicionar botão de retry:
```tsx
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['order-tickets', orderId],
  queryFn: () => getOrderTickets(orderId, token),
  retry: 3,
});
// ...
{error && (
  <div className="flex flex-col gap-2">
    <p role="alert" className="text-sm text-destructive">...</p>
    <button type="button" onClick={() => void refetch()}>Tentar novamente</button>
  </div>
)}
```

---

#### MK-05 — MÉDIO

**Arquivo:** `apps/marketplace-web/src/features/payment-status/hooks/usePaymentPolling.ts`

**Trecho:**
```ts
} catch {
  // swallow network errors — next tick will retry
}
```

**Problema:** Erros de rede no polling de pagamento são silenciados completamente. Se o servidor retornar 401 (sessão expirada), 404 (order não encontrado) ou 500, o hook continua fazendo poll até o timeout de 5 minutos sem notificar o usuário. O `onTimeout` só é chamado após 5 minutos — o usuário fica sem feedback por até 5 minutos em caso de erro permanente.

**Impacto:** Em caso de erro não-recuperável (ex: 404, 401), o usuário espera 5 minutos por uma confirmação que nunca virá, sem nenhuma mensagem de erro.

**Correção recomendada:** Distinguir erros recuperáveis (timeout de rede) de erros permanentes (4xx):
```ts
} catch (e) {
  if (e instanceof Error && 'status' in e) {
    const status = (e as { status: number }).status;
    if (status === 404 || status === 401 || status === 410) {
      clearTimers();
      activeRef.current = false;
      onTimeout(); // ou um callback onError separado
      return;
    }
  }
  // erros de rede transitórios: continuar retry
}
```

---

#### MK-06 — MÉDIO

**Arquivo:** `apps/marketplace-web/src/features/reservation/hooks/use-create-reservation.ts`

**Trecho:**
```ts
const resetAttempt = useCallback(() => undefined, []);
```

**Problema:** `resetAttempt` é um callback que retorna `undefined` e não faz nada. É exportado na interface pública do hook mas está vazio — provavelmente um placeholder não implementado. Exportar uma função que não faz nada pode enganar consumidores do hook que esperem que ela limpe o estado de erro.

**Impacto:** Interface de API enganosa — consumidores chamam `resetAttempt()` esperando que o erro seja limpo, mas o estado `error` permanece inalterado.

**Correção recomendada:** Implementar corretamente:
```ts
const resetAttempt = useCallback(() => setError(null), []);
```

---

#### MK-07 — MÉDIO

**Arquivo:** `apps/marketplace-web/src/features/public-event-catalog/components/EventCard.tsx`

**Trecho:**
```tsx
<Link
  href={`/events/${event.slug}`}
  className="flex h-full flex-col gap-2 rounded-lg border border-input bg-background p-5 ..."
>
  <h2 className="text-lg font-semibold text-foreground">{event.title}</h2>
```

**Problema:** O card inteiro é um link (`<Link>` wrapping tudo), e o `<h2>` dentro não tem nenhum texto adicional. Leitores de tela anunciarão o link com todo o conteúdo do card concatenado (título + formato + data), o que pode ser verboso e confuso. Mais importante: o card não exibe preço mínimo dos ingressos — usuário não tem informação de preço antes de clicar no evento. Em um marketplace de ingressos, ausência de preço no card de catálogo é uma lacuna UX relevante.

**Impacto:** Experiência de compra degradada — usuário precisa abrir cada evento para descobrir o preço mínimo.

**Correção recomendada:** Adicionar `aria-label` ao link com texto conciso. Considerar exibir o preço mínimo se disponível no `PublicEventListItem`.

---

#### MK-08 — BAIXO

**Arquivo:** `apps/marketplace-web/src/features/public-event-catalog/components/EventList.tsx`

**Trecho:**
```tsx
<p className="text-muted-foreground" role="status">
  Nenhum evento publicado no momento.
</p>
```

**Problema:** `role="status"` é para conteúdo que muda dinamicamente (live regions). Para um estado vazio estático, `role="status"` é semanticamente incorreto — pode ser interpretado como uma live region em atualizações futuras. Para conteúdo estático de "lista vazia", não é necessário role especial.

**Impacto:** Semântica ARIA incorreta — baixo impacto prático mas viola as diretrizes WAI-ARIA.

**Correção recomendada:** Remover `role="status"` ou substituir por `role="note"` se quiser indicar informação contextual estática.

---

#### MK-09 — BAIXO

**Arquivo:** `apps/marketplace-web/src/features/payment-method/SelectMethodView.tsx`

**Trecho:**
```tsx
<Button onClick={() => { onSelect('FAKE_PIX'); }} ...>
  Pagar com PIX
</Button>
<Button onClick={() => { onSelect('FAKE_CREDIT_CARD'); }} ...>
  Pagar com Cartão
</Button>
```

**Problema:** Os nomes dos métodos de pagamento expostos internamente (`FAKE_PIX`, `FAKE_CREDIT_CARD`) são claramente identificadores de desenvolvimento. O componente funciona corretamente para o propósito atual, mas o nome `FAKE_` nos enums `PaymentMethod` vazará em logs de frontend, DevTools e relatórios de erro em produção se não for renomeado antes do lançamento.

**Impacto:** Baixo risco funcional; alto risco de reputação se nomes `FAKE_*` aparecerem em produção em mensagens de erro ou logs visíveis ao usuário.

**Correção recomendada:** Renomear `FAKE_PIX` → `PIX` e `FAKE_CREDIT_CARD` → `CREDIT_CARD` (ou equivalente) antes do lançamento. Garantir consistência com a API.

---

## Cobertura de testes

| Feature | Testes presentes | Observação |
|---------|-----------------|------------|
| `attendance/AttendanceDashboard` | Sim | `AttendanceDashboard.test.tsx` |
| `attendance/AttendanceStats` | Sim | `AttendanceStats.test.tsx` |
| `attendance/RecentCheckIns` | Sim | `RecentCheckIns.test.tsx` |
| `attendance/useAttendancePolling` | Sim | `useAttendancePolling.test.ts` |
| `finance/` (todos os componentes) | **Não** | Nenhum arquivo `.test.*` encontrado |
| `platform-admin/` (todos os componentes) | **Não** | Nenhum arquivo `.test.*` encontrado |
| `organizations/schemas` | Sim | `schemas/index.spec.ts` |
| `publication-readiness/PublicationChecklist` | Sim | `PublicationChecklist.test.tsx` |
| `publish-event/PublishEventPanel` | Sim | `PublishEventPanel.test.tsx` |
| `publish-event/idempotency` | Sim | `idempotency.spec.ts` |
| `checkout/CheckoutPage` | Sim | `CheckoutPage.test.tsx` |
| `payment-method/SelectMethodView` | Sim | `SelectMethodView.test.tsx` |
| `payment-status/usePaymentPolling` | Sim | `usePaymentPolling.test.ts` |
| `payment-status/PaymentStatusView` | Sim | `PaymentStatusView.test.tsx` |
| `public-event-catalog/EventCard` | Sim | `EventCard.test.tsx` |
| `reservation/use-countdown` | Sim | `use-countdown.test.tsx` |
| `reservation/use-create-reservation` | Sim | `use-create-reservation.test.tsx` |
| `reservation/reservation-session` | Sim | `reservation-session.test.ts` |
| `order-confirmation/ConfirmationView` | Sim | `ConfirmationView.test.tsx` |

**Lacuna crítica:** O módulo `finance/` do backoffice — que cobre saldo, transações, payouts e o modal de saque — não possui nenhum teste. Este é o módulo financeiro mais sensível do backoffice, com operações de criação de payout e exibição de saldo. A ausência de testes é uma lacuna prioritária.

**Lacuna secundária:** O módulo `platform-admin/` — que cobre ações administrativas de suspensão/reativação de organizações e usuários — também não possui testes. Ações destrutivas irreversíveis sem cobertura de teste representam risco operacional.

---

## Resumo executivo

### Por classificação

| Classificação | Quantidade |
|--------------|-----------|
| BLOQUEANTE | 0 |
| ALTO | 4 (BO-01, BO-02, MK-01, MK-02) |
| MÉDIO | 9 (BO-03 a BO-10, MK-03 a MK-06) |
| BAIXO | 5 (BO-11 a BO-15, MK-07 a MK-09) |

### Prioridades imediatas

1. **BO-01** — Autenticação via `NEXT_PUBLIC_DEV_USER_ID` no polling de presença: substituir por mecanismo de sessão real antes do deploy.
2. **MK-02** — Botão "Copiar código PIX" ausente: bloqueia o fluxo de pagamento PIX em mobile.
3. **BO-03/BO-04/MK-01** — Hydration mismatch em `toLocaleString`/`toLocaleTimeString` sem `timeZone`: padrão recorrente que deve ser resolvido via helper centralizado.
4. ~~**BO-05** — `setState` dentro de `queryFn`~~ — **CORRIGIDO 2026-08-25**: `usePayouts.ts` e `useTransactions.ts` migrados para `queryFn` puro (retorna dados) + `useEffect([query.data])` para acumular itens. Elimina side-effect durante renderização e duplicação em background refetch.
5. ~~**MK-04** — Sem retry na ConfirmationView~~ — **CORRIGIDO 2026-08-25**: `ConfirmationView.tsx` agora usa `retryCount` state; `useEffect` inclui `retryCount` na dependency array; botão "Tentar novamente" visível no estado de erro.
6. ~~**MK-05** — Payment polling swallows all errors~~ — **CORRIGIDO 2026-08-25**: `usePaymentPolling.ts` distingue erros permanentes (`PublicApiError` com status 401/403/404/410) — para polling e chama `onTimeout` imediatamente. Erros transientes continuam retry normal.
6. **Testes** — Criar testes para `finance/` e `platform-admin/` antes de habilitar operações financeiras e administrativas em produção.
