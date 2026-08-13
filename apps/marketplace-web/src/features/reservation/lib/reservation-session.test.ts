import {
  clearReservationSession,
  createIdempotencyKey,
  getOrCreateReservationAttemptKey,
  getOrCreateOrderKey,
  getReservationEventSlug,
  getReservationToken,
  saveReservationSession,
} from './reservation-session';

const reservationId = 'd61805ca-1d0c-42ca-8627-5b5914d12c29';

describe('reservation session', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn()
        .mockReturnValueOnce('4d3ce4d5-b7c3-4806-a290-31d6ac8690d4')
        .mockReturnValueOnce('029105ae-1e9f-4121-86a5-41eb15742d28'),
    });
  });

  it('persists only the reservation token and event in session storage', () => {
    saveReservationSession(reservationId, 'reservation-token', 'summer-fest');

    expect(getReservationToken(reservationId)).toBe('reservation-token');
    expect(getReservationEventSlug(reservationId)).toBe('summer-fest');
    expect(localStorage.getItem(`reservation_token_${reservationId}`)).toBeNull();
  });

  it('keeps a stable order idempotency key for the reservation session', () => {
    expect(getOrCreateOrderKey(reservationId)).toBe('4d3ce4d5-b7c3-4806-a290-31d6ac8690d4');
    expect(getOrCreateOrderKey(reservationId)).toBe('4d3ce4d5-b7c3-4806-a290-31d6ac8690d4');
  });

  it('clears all reservation-session state after expiry or cancellation', () => {
    saveReservationSession(reservationId, 'reservation-token', 'summer-fest');
    getOrCreateOrderKey(reservationId);

    clearReservationSession(reservationId);

    expect(getReservationToken(reservationId)).toBeNull();
    expect(getReservationEventSlug(reservationId)).toBeNull();
    expect(sessionStorage.getItem(`reservation_order_key_${reservationId}`)).toBeNull();
  });

  it('persists a reservation attempt key for the same selection across remounts', () => {
    const items = [{ ticketTypeId: '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048', quantity: 1 }];

    expect(getOrCreateReservationAttemptKey('summer-fest', items)).toBe('4d3ce4d5-b7c3-4806-a290-31d6ac8690d4');
    expect(getOrCreateReservationAttemptKey('summer-fest', items)).toBe('4d3ce4d5-b7c3-4806-a290-31d6ac8690d4');
  });

  it('uses secure random values when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined });
    Object.defineProperty(globalThis.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint8Array) => values.map((_, index) => index),
    });

    expect(createIdempotencyKey()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });
});
