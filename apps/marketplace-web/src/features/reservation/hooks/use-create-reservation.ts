'use client';

import { useCallback, useState } from 'react';
import { createPublicReservation, type PublicReservation } from '@/shared/api/public-reservations.api';
import {
  clearReservationAttemptKey,
  getOrCreateReservationAttemptKey,
  saveReservationSession,
} from '../lib/reservation-session';

export function useCreateReservation(eventSlug: string) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resetAttempt = useCallback(() => undefined, []);
  const create = useCallback(async (items: Array<{ ticketTypeId: string; quantity: number }>): Promise<PublicReservation> => {
    setIsCreating(true);
    setError(null);
    try {
      const reservation = await createPublicReservation({
        eventSlug,
        items,
        idempotencyKey: getOrCreateReservationAttemptKey(eventSlug, items),
      });
      if (!reservation.token) throw new Error('Reservation token was not returned');
      saveReservationSession(reservation.reservationId, reservation.token, eventSlug);
      clearReservationAttemptKey(eventSlug, items);
      return reservation;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Could not create reservation');
      setError(nextError);
      throw nextError;
    } finally {
      setIsCreating(false);
    }
  }, [eventSlug]);

  return { create, isCreating, error, resetAttempt };
}
