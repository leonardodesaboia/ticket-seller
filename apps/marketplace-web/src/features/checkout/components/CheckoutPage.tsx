'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPublicOrder, type PublicOrder } from '@/shared/api/public-orders.api';
import { PublicApiError, getPublicReservation, type PublicReservation } from '@/shared/api/public-reservations.api';
import {
  createPaymentAttempt,
  getLatestPaymentAttempt,
  type PaymentAttemptResponse,
  type PaymentMethod,
} from '@/shared/api/public-payments.api';
import { formatCurrency } from '@/shared/lib/money';
import { Button } from '@/shared/ui/primitives/button';
import {
  clearReservationSession,
  formatRemainingTime,
  getOrCreateOrderKey,
  getReservationEventSlug,
  getReservationToken,
  useCountdown,
} from '@/features/reservation';
import { SelectMethodView } from '@/features/payment-method/SelectMethodView';
import { PaymentStatusView } from '@/features/payment-status/PaymentStatusView';
import { ConfirmationView } from '@/features/order-confirmation/ConfirmationView';
import { getOrCreatePaymentKey, resetPaymentKey } from '@/features/payment-status/lib/payment-session';

interface CheckoutPageProps { reservationId: string; }

/**
 * LOADING         — initial fetch in progress
 * INIT_ERROR      — initialization failed (no order loaded yet); full error page with retry
 * ORDER_EXPIRED   — reservation/order expired; full error page without retry
 * SELECTING_METHOD — order loaded, awaiting method choice
 * CREATING_PAYMENT — payment attempt creation in progress
 * ERROR_CREATING  — payment attempt creation failed; error shown inline in SelectMethodView
 * PIX_WAITING     — PENDING/PROCESSING PIX attempt; showing code + polling
 * CARD_WAITING    — PENDING/PROCESSING card attempt; showing placeholder + polling
 * PAYMENT_DECLINED — attempt DECLINED or CANCELLED
 * PAYMENT_EXPIRED  — attempt EXPIRED
 * CONFIRMED       — order PAID/TICKETS_ISSUED; show tickets
 */
type CheckoutState =
  | 'LOADING'
  | 'INIT_ERROR'
  | 'SELECTING_METHOD'
  | 'CREATING_PAYMENT'
  | 'PIX_WAITING'
  | 'CARD_WAITING'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_EXPIRED'
  | 'ORDER_EXPIRED'
  | 'CONFIRMED'
  | 'ERROR_CREATING';

const ACTIVE_ATTEMPT_STATUSES = ['PENDING', 'PROCESSING'] as const;

function resolveAttemptState(attempt: PaymentAttemptResponse): CheckoutState {
  if (attempt.status === 'APPROVED') return 'CONFIRMED';
  if (attempt.status === 'DECLINED' || attempt.status === 'CANCELLED') return 'PAYMENT_DECLINED';
  if (attempt.status === 'EXPIRED') return 'PAYMENT_EXPIRED';
  if (attempt.paymentMethod === 'FAKE_PIX') return 'PIX_WAITING';
  return 'CARD_WAITING';
}

export function CheckoutPage({ reservationId }: CheckoutPageProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<PublicReservation | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptResponse | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('LOADING');
  const [error, setError] = useState<string | null>(null);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const { remaining, expired } = useCountdown(order?.expiresAt ?? reservation?.expiresAt ?? null);

  useEffect(() => { setEventSlug(getReservationEventSlug(reservationId)); }, [reservationId]);
  useEffect(() => { if (error && (checkoutState === 'INIT_ERROR' || checkoutState === 'ORDER_EXPIRED')) errorRef.current?.focus(); }, [error, checkoutState]);

  const initializeCheckout = useCallback(async () => {
    const token = getReservationToken(reservationId);
    if (!token) {
      const savedEventSlug = getReservationEventSlug(reservationId);
      router.replace(savedEventSlug ? `/events/${savedEventSlug}?reservation=lost` : '/');
      return;
    }
    setCheckoutState('LOADING');
    setError(null);
    try {
      const currentReservation = await getPublicReservation(reservationId, token);
      setReservation(currentReservation);
      const nextOrder = await createPublicOrder({ reservationId, token, idempotencyKey: getOrCreateOrderKey(reservationId) });
      setOrder(nextOrder);

      // If order already has tickets issued, go straight to confirmation
      if (nextOrder.status === 'TICKETS_ISSUED' || nextOrder.status === 'PAID') {
        setCheckoutState('CONFIRMED');
        return;
      }

      // Order is PENDING_PAYMENT — check if a payment attempt exists
      const latestAttempt = await getLatestPaymentAttempt(nextOrder.orderId, token);
      if (!latestAttempt) {
        setCheckoutState('SELECTING_METHOD');
        return;
      }

      setAttempt(latestAttempt);
      if ((ACTIVE_ATTEMPT_STATUSES as readonly string[]).includes(latestAttempt.status)) {
        setCheckoutState(latestAttempt.paymentMethod === 'FAKE_PIX' ? 'PIX_WAITING' : 'CARD_WAITING');
      } else {
        setCheckoutState(resolveAttemptState(latestAttempt));
      }
    } catch (cause) {
      if (cause instanceof PublicApiError && (cause.status === 410 || cause.code === 'RESERVATION_EXPIRED')) {
        clearReservationSession(reservationId);
        setCheckoutState('ORDER_EXPIRED');
        setError('Sua reserva expirou. Selecione seus ingressos novamente.');
      } else {
        setError('Não foi possível preparar seu checkout. Tente novamente.');
        setCheckoutState('INIT_ERROR');
      }
    }
  }, [reservationId, router]);

  useEffect(() => { void initializeCheckout(); }, [initializeCheckout]);

  useEffect(() => {
    if (expired && checkoutState !== 'CONFIRMED' && checkoutState !== 'ORDER_EXPIRED') {
      clearReservationSession(reservationId);
      setOrder(null);
      setCheckoutState('ORDER_EXPIRED');
      setError('Sua reserva expirou. Selecione seus ingressos novamente.');
    }
  }, [expired, reservationId, checkoutState]);

  const handleSelectMethod = useCallback(async (method: PaymentMethod) => {
    const token = getReservationToken(reservationId);
    if (!token || !order) return;
    setCheckoutState('CREATING_PAYMENT');
    setError(null);
    try {
      const idempotencyKey = getOrCreatePaymentKey(order.orderId);
      const newAttempt = await createPaymentAttempt(order.orderId, token, idempotencyKey, method);
      setAttempt(newAttempt);
      setCheckoutState(newAttempt.paymentMethod === 'FAKE_PIX' ? 'PIX_WAITING' : 'CARD_WAITING');
    } catch (cause) {
      setCheckoutState('ERROR_CREATING');
      if (cause instanceof PublicApiError && cause.status === 410) {
        setError('Pedido expirado. Volte ao evento e tente novamente.');
      } else if (cause instanceof PublicApiError && cause.status === 503) {
        setError('Serviço de pagamento indisponível. Tente novamente em instantes.');
      } else {
        setError('Não foi possível criar o pagamento. Tente novamente.');
      }
    }
  }, [reservationId, order]);

  const handleNewAttempt = useCallback(() => {
    if (!order) return;
    // Generate a new idempotency key for a fresh attempt
    resetPaymentKey(order.orderId);
    setAttempt(null);
    setError(null);
    setCheckoutState('SELECTING_METHOD');
  }, [order]);

  const handleConfirmed = useCallback(() => {
    setCheckoutState('CONFIRMED');
  }, []);

  const handleTimeout = useCallback(() => {
    setError('O tempo de verificação expirou. Recarregue a página para verificar o status do pagamento.');
    setCheckoutState('ERROR_CREATING');
  }, []);

  const token = getReservationToken(reservationId);

  // --- Render ---

  if (checkoutState === 'LOADING') {
    return <main className="mx-auto max-w-2xl p-8" aria-busy="true">Preparando seu checkout…</main>;
  }

  // Full-page error states (no order shown)
  if (checkoutState === 'INIT_ERROR' || checkoutState === 'ORDER_EXPIRED') {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <p ref={errorRef} role="alert" tabIndex={-1} className="text-destructive">{error}</p>
        {eventSlug && <Link className="text-primary underline" href={`/events/${eventSlug}`}>Voltar ao evento</Link>}
        {checkoutState === 'INIT_ERROR' && (
          <Button onClick={() => { void initializeCheckout(); }}>Tentar novamente</Button>
        )}
      </main>
    );
  }

  if (checkoutState === 'CONFIRMED' && order && token) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <header>
          <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          {eventSlug && <p className="text-sm text-muted-foreground">Evento: {eventSlug}</p>}
        </header>
        <ConfirmationView orderId={order.orderId} token={token} />
      </main>
    );
  }

  if (!order) return null;

  const isCreating = checkoutState === 'CREATING_PAYMENT';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
        {eventSlug && <p className="text-sm text-muted-foreground">Evento: {eventSlug}</p>}
      </header>

      <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium tabular-nums ${remaining < 180 ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-input text-muted-foreground'}`}>
        <span aria-hidden="true">⏱</span>
        <span>Reserva expira em <strong>{formatRemainingTime(remaining)}</strong></span>
      </div>
      <span aria-live="polite" className="sr-only">{Math.ceil(remaining / 60)} minuto(s) restante(s) para a reserva</span>

      <section aria-labelledby="order-summary-heading" className="rounded-md border border-input p-4">
        <h2 id="order-summary-heading" className="text-lg font-semibold text-foreground">Resumo do pedido</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.ticketTypeId} className="flex justify-between gap-4">
              <span>
                {item.quantity}× {item.name}
                <small className="block text-muted-foreground">{formatCurrency(item.unitPriceAmount, order.currency)} cada</small>
              </span>
              <span>{formatCurrency(item.subtotalAmount, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 border-t border-input pt-4">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd></div>
          <div className="mt-2 flex justify-between font-semibold"><dt>Total</dt><dd>{formatCurrency(order.totalAmount, order.currency)}</dd></div>
        </dl>
      </section>

      {(checkoutState === 'SELECTING_METHOD' || checkoutState === 'CREATING_PAYMENT' || checkoutState === 'ERROR_CREATING') && (
        <SelectMethodView
          onSelect={(method) => { void handleSelectMethod(method); }}
          isCreating={isCreating}
          {...(error != null ? { error } : {})}
        />
      )}

      {(checkoutState === 'PIX_WAITING' || checkoutState === 'CARD_WAITING' || checkoutState === 'PAYMENT_DECLINED' || checkoutState === 'PAYMENT_EXPIRED') && attempt && token && (
        <PaymentStatusView
          attempt={attempt}
          token={token}
          onNewAttempt={handleNewAttempt}
          onConfirmed={handleConfirmed}
          onTimeout={handleTimeout}
        />
      )}
    </main>
  );
}
