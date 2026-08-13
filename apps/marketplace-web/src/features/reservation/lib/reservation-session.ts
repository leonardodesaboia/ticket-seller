const tokenKey = (reservationId: string) => `reservation_token_${reservationId}`;
const eventKey = (reservationId: string) => `reservation_event_${reservationId}`;
const orderKey = (reservationId: string) => `reservation_order_key_${reservationId}`;
const attemptKey = (eventSlug: string, items: Array<{ ticketTypeId: string; quantity: number }>) => {
  const selection = [...items]
    .sort((left, right) => left.ticketTypeId.localeCompare(right.ticketTypeId))
    .map(({ ticketTypeId, quantity }) => `${ticketTypeId}:${quantity}`)
    .join(',');
  return `reservation_attempt_${eventSlug}_${selection}`;
};

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure idempotency key generation is unavailable');
  }
  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateReservationAttemptKey(
  eventSlug: string,
  items: Array<{ ticketTypeId: string; quantity: number }>,
): string {
  if (typeof window === 'undefined') return createIdempotencyKey();
  const key = attemptKey(eventSlug, items);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const idempotencyKey = createIdempotencyKey();
  sessionStorage.setItem(key, idempotencyKey);
  return idempotencyKey;
}

export function clearReservationAttemptKey(
  eventSlug: string,
  items: Array<{ ticketTypeId: string; quantity: number }>,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(attemptKey(eventSlug, items));
}

export function saveReservationSession(reservationId: string, token: string, eventSlug: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(tokenKey(reservationId), token);
  sessionStorage.setItem(eventKey(reservationId), eventSlug);
}

export function getReservationToken(reservationId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(tokenKey(reservationId));
}

export function getReservationEventSlug(reservationId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(eventKey(reservationId));
}

export function getOrCreateOrderKey(reservationId: string): string {
  if (typeof window === 'undefined') return createIdempotencyKey();
  const existing = sessionStorage.getItem(orderKey(reservationId));
  if (existing) return existing;
  const key = createIdempotencyKey();
  sessionStorage.setItem(orderKey(reservationId), key);
  return key;
}

export function clearReservationSession(reservationId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(tokenKey(reservationId));
  sessionStorage.removeItem(eventKey(reservationId));
  sessionStorage.removeItem(orderKey(reservationId));
}
