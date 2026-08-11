'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPublicOrder, type PublicOrder } from '@/shared/api/public-orders.api';
import { PublicApiError, getPublicReservation, type PublicReservation } from '@/shared/api/public-reservations.api';
import { formatCurrency } from '@/shared/lib/money';
import { Button } from '@/shared/ui/primitives/button';
import { clearReservationSession, formatRemainingTime, getOrCreateOrderKey, getReservationEventSlug, getReservationToken, useCountdown } from '@/features/reservation';

interface CheckoutPageProps { reservationId: string; }

export function CheckoutPage({ reservationId }: CheckoutPageProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<PublicReservation | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const { remaining, expired } = useCountdown(order?.expiresAt ?? reservation?.expiresAt ?? null);
  useEffect(() => { setEventSlug(getReservationEventSlug(reservationId)); }, [reservationId]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const createOrder = useCallback(async () => {
    const token = getReservationToken(reservationId);
    if (!token) {
      const savedEventSlug = getReservationEventSlug(reservationId);
      router.replace(savedEventSlug ? `/events/${savedEventSlug}?reservation=lost` : '/');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const currentReservation = await getPublicReservation(reservationId, token);
      setReservation(currentReservation);
      const nextOrder = await createPublicOrder({ reservationId, token, idempotencyKey: getOrCreateOrderKey(reservationId) });
      setOrder(nextOrder);
    } catch (cause) {
      if (cause instanceof PublicApiError && (cause.status === 410 || cause.code === 'RESERVATION_EXPIRED')) {
        clearReservationSession(reservationId);
        setError('Sua reserva expirou. Selecione seus ingressos novamente.');
      } else {
        setError('Não foi possível preparar seu checkout. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [reservationId, router]);

  useEffect(() => { void createOrder(); }, [createOrder]);
  useEffect(() => {
    if (expired) {
      clearReservationSession(reservationId);
      setOrder(null);
      setError('Sua reserva expirou. Selecione seus ingressos novamente.');
    }
  }, [expired, reservationId]);

  if (loading) return <main className="mx-auto max-w-2xl p-8" aria-busy="true">Preparando seu checkout…</main>;
  if (error) return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8"><p ref={errorRef} role="alert" tabIndex={-1} className="text-destructive">{error}</p>{eventSlug && <Link className="text-primary underline" href={`/events/${eventSlug}`}>Voltar ao evento</Link>}{!expired && <Button onClick={() => { void createOrder(); }}>Tentar novamente</Button>}</main>;
  if (!order) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header><h1 className="text-3xl font-bold text-foreground">Checkout</h1>{eventSlug && <p className="text-sm text-muted-foreground">Evento: {eventSlug}</p>}<p className="text-muted-foreground">Pagamento será disponibilizado na próxima etapa.</p></header>
      <p className="text-sm text-muted-foreground">Reserva expira em {formatRemainingTime(remaining)}</p>
      <p aria-live="polite" className="sr-only">{Math.ceil(remaining / 60)} minuto(s) restante(s) para a reserva</p>
      <section aria-labelledby="order-summary-heading" className="rounded-md border border-input p-4">
        <h2 id="order-summary-heading" className="text-lg font-semibold text-foreground">Resumo do pedido</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {order.items.map((item) => <li key={item.ticketTypeId} className="flex justify-between gap-4"><span>{item.quantity}× {item.name}<small className="block text-muted-foreground">{formatCurrency(item.unitPriceAmount, order.currency)} cada</small></span><span>{formatCurrency(item.subtotalAmount, order.currency)}</span></li>)}
        </ul>
        <dl className="mt-4 border-t border-input pt-4"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd></div><div className="mt-2 flex justify-between font-semibold"><dt>Total</dt><dd>{formatCurrency(order.totalAmount, order.currency)}</dd></div></dl>
      </section>
    </main>
  );
}
