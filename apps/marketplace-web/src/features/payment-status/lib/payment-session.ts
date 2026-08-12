import { createIdempotencyKey } from '@/features/reservation';

const paymentKey = (orderId: string) => `payment_idempotency_key_${orderId}`;

export function getOrCreatePaymentKey(orderId: string): string {
  if (typeof window === 'undefined') return createIdempotencyKey();
  const existing = sessionStorage.getItem(paymentKey(orderId));
  if (existing) return existing;
  const key = createIdempotencyKey();
  sessionStorage.setItem(paymentKey(orderId), key);
  return key;
}

export function resetPaymentKey(orderId: string): string {
  if (typeof window === 'undefined') return createIdempotencyKey();
  const key = createIdempotencyKey();
  sessionStorage.setItem(paymentKey(orderId), key);
  return key;
}
