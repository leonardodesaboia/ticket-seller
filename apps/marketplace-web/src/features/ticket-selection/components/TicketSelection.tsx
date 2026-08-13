'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicAvailability, type PublicAvailabilityItem } from '@/shared/api/public-availability.api';
import type { PublicTicketType } from '@/shared/api/public-events.api';
import { formatCurrency } from '@/shared/lib/money';
import { Button } from '@/shared/ui/primitives/button';
import { useCreateReservation } from '@/features/reservation';

interface TicketSelectionProps {
  eventSlug: string;
  currency: string;
  ticketTypes: PublicTicketType[];
}

export function TicketSelection({ eventSlug, currency, ticketTypes }: TicketSelectionProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { create, error, isCreating, resetAttempt } = useCreateReservation(eventSlug);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  useEffect(() => {
    let active = true;
    getPublicAvailability(eventSlug)
      .then((result) => {
        if (!active) return;
        setAvailability(Object.fromEntries(result.items.map((item: PublicAvailabilityItem) => [item.ticketTypeId, item.availableQuantity])));
      })
      .catch(() => { if (active) setAvailability({}); });
    return () => { active = false; };
  }, [eventSlug]);

  const selected = useMemo(() => ticketTypes
    .map((ticketType) => ({ ticketType, quantity: quantities[ticketType.ticketTypeId] ?? 0 }))
    .filter(({ quantity }) => quantity > 0), [quantities, ticketTypes]);
  const subtotal = selected.reduce((total, { ticketType, quantity }) => total + ticketType.price * quantity, 0);
  const hasSelection = selected.length > 0;

  const updateQuantity = (ticketTypeId: string, nextQuantity: number, limit: number) => {
    const quantity = Math.max(0, Math.min(limit, nextQuantity));
    setQuantities((current) => ({ ...current, [ticketTypeId]: quantity }));
    resetAttempt();
  };

  const reserve = async () => {
    if (!hasSelection || isCreating) return;
    const reservation = await create(selected.map(({ ticketType, quantity }) => ({ ticketTypeId: ticketType.ticketTypeId, quantity })));
    router.push(`/checkout/${reservation.reservationId}`);
  };

  return (
    <section aria-labelledby="ticket-selection-heading" className="flex flex-col gap-4">
      <h2 id="ticket-selection-heading" className="text-lg font-semibold text-foreground">Selecione seus ingressos</h2>
      {availability === null ? <p className="text-sm text-muted-foreground">Carregando disponibilidade…</p> : (
        <ul className="flex flex-col gap-3">
          {ticketTypes.map((ticketType) => {
            const available = availability[ticketType.ticketTypeId] ?? 0;
            const quantity = quantities[ticketType.ticketTypeId] ?? 0;
            const unavailable = available === 0;
            return (
              <li key={ticketType.ticketTypeId} className="rounded-md border border-input p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">{ticketType.name}</h3>
                    {ticketType.description && <p className="text-sm text-muted-foreground">{ticketType.description}</p>}
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(ticketType.price, ticketType.currency ?? currency)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{unavailable ? 'Indisponível' : `${available} disponível(is)`}</p>
                  </div>
                  <div className="flex items-center gap-2" aria-label={`Quantidade de ${ticketType.name}`}>
                    <Button type="button" variant="outline" size="icon" aria-label={`Diminuir quantidade de ${ticketType.name}`} disabled={quantity === 0 || isCreating} onClick={() => updateQuantity(ticketType.ticketTypeId, quantity - 1, available)}>−</Button>
                    <output aria-label={`Quantidade selecionada de ${ticketType.name}`} className="min-w-6 text-center">{quantity}</output>
                    <Button type="button" variant="outline" size="icon" aria-label={`Aumentar quantidade de ${ticketType.name}`} disabled={quantity >= available || unavailable || isCreating} onClick={() => updateQuantity(ticketType.ticketTypeId, quantity + 1, available)}>+</Button>
                  </div>
                </div>
                {quantity > 0 && <p className="mt-3 text-sm text-muted-foreground">Subtotal: {formatCurrency(ticketType.price * quantity, ticketType.currency ?? currency)}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-input pt-4">
        <p className="font-semibold text-foreground">Subtotal visual: {formatCurrency(subtotal, currency)}</p>
        <Button type="button" disabled={!hasSelection || availability === null || isCreating} onClick={() => { void reserve(); }}> {isCreating ? 'Reservando…' : 'Reservar ingressos'} </Button>
      </div>
      {error && <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive">Não foi possível criar a reserva. Tente novamente.</p>}
    </section>
  );
}
